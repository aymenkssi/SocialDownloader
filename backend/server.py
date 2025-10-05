from fastapi import FastAPI, APIRouter, HTTPException, BackgroundTasks
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, HttpUrl
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime
import yt_dlp
import tempfile
import asyncio
from concurrent.futures import ThreadPoolExecutor
import json


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Thread pool for CPU-bound operations
executor = ThreadPoolExecutor(max_workers=4)


# Define Models
class VideoURLRequest(BaseModel):
    url: str

class VideoFormat(BaseModel):
    format_id: str
    ext: str
    resolution: Optional[str] = None
    filesize: Optional[int] = None
    format_note: Optional[str] = None
    vcodec: Optional[str] = None
    acodec: Optional[str] = None

class VideoMetadata(BaseModel):
    title: str
    thumbnail: Optional[str] = None
    duration: Optional[int] = None
    uploader: Optional[str] = None
    platform: str
    webpage_url: str
    formats: List[Dict[str, Any]] = []

class DownloadRequest(BaseModel):
    url: str
    format_id: Optional[str] = None
    quality: Optional[str] = "best"  # best, 1080p, 720p, 480p, 360p, audio


# Platform detection
def detect_platform(url: str) -> str:
    """Detect the platform from URL"""
    url_lower = url.lower()
    if 'youtube.com' in url_lower or 'youtu.be' in url_lower:
        return 'YouTube'
    elif 'tiktok.com' in url_lower:
        return 'TikTok'
    elif 'instagram.com' in url_lower:
        return 'Instagram'
    elif 'facebook.com' in url_lower or 'fb.watch' in url_lower:
        return 'Facebook'
    elif 'twitter.com' in url_lower or 'x.com' in url_lower:
        return 'Twitter/X'
    elif 'linkedin.com' in url_lower:
        return 'LinkedIn'
    else:
        return 'Unknown'


def extract_video_info(url: str) -> dict:
    """Extract video information using yt-dlp"""
    ydl_opts = {
        'quiet': True,
        'no_warnings': True,
        'extract_flat': False,
        'nocheckcertificate': True,
        'user_agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    }
    
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
            
            # Process formats to include useful information
            formats = []
            if 'formats' in info:
                for fmt in info['formats']:
                    format_data = {
                        'format_id': fmt.get('format_id'),
                        'ext': fmt.get('ext'),
                        'resolution': fmt.get('resolution') or f"{fmt.get('height', 'audio')}p",
                        'filesize': fmt.get('filesize'),
                        'format_note': fmt.get('format_note'),
                        'vcodec': fmt.get('vcodec'),
                        'acodec': fmt.get('acodec'),
                        'height': fmt.get('height'),
                    }
                    formats.append(format_data)
            
            return {
                'title': info.get('title', 'Unknown'),
                'thumbnail': info.get('thumbnail'),
                'duration': info.get('duration'),
                'uploader': info.get('uploader') or info.get('channel'),
                'platform': detect_platform(url),
                'webpage_url': info.get('webpage_url', url),
                'formats': formats,
            }
    except Exception as e:
        logger.error(f"Error extracting video info: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Failed to extract video info: {str(e)}")


@api_router.post("/video/metadata")
async def get_video_metadata(request: VideoURLRequest):
    """Get video metadata from URL"""
    try:
        loop = asyncio.get_event_loop()
        info = await loop.run_in_executor(executor, extract_video_info, request.url)
        return info
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting metadata: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


def download_video_generator(url: str, quality: str):
    """Generator function to stream video download"""
    temp_dir = tempfile.mkdtemp()
    filename = None
    
    try:
        # Configure yt-dlp options based on quality
        # Set FFmpeg location
        ffmpeg_location = '/usr/bin/ffmpeg'
        
        # Common options with enhanced YouTube support
        common_opts = {
            'nocheckcertificate': True,
            'no_warnings': True,
            'quiet': False,  # Enable logs for debugging
            'no_color': True,
            'extract_flat': False,
            'socket_timeout': 30,
            'retries': 10,
            'fragment_retries': 10,
            'http_headers': {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-us,en;q=0.5',
                'Accept-Encoding': 'gzip, deflate',
                'Connection': 'keep-alive',
            },
        }
        
        if quality == 'audio':
            ydl_opts = {
                **common_opts,
                'format': 'bestaudio/best',
                'outtmpl': f'{temp_dir}/video.%(ext)s',
                'postprocessors': [{
                    'key': 'FFmpegExtractAudio',
                    'preferredcodec': 'mp3',
                    'preferredquality': '192',
                }],
                'ffmpeg_location': ffmpeg_location,
            }
            expected_ext = 'mp3'
        else:
            # Video quality selection - use format that works without merging
            format_str = 'best[ext=mp4]/best'
            
            if quality == '360p':
                format_str = 'best[height<=360][ext=mp4]/best[height<=360]/best'
            elif quality == '480p':
                format_str = 'best[height<=480][ext=mp4]/best[height<=480]/best'
            elif quality == '720p':
                format_str = 'best[height<=720][ext=mp4]/best[height<=720]/best'
            elif quality == '1080p':
                format_str = 'best[height<=1080][ext=mp4]/best[height<=1080]/best'
            
            ydl_opts = {
                **common_opts,
                'format': format_str,
                'outtmpl': f'{temp_dir}/video.%(ext)s',
                'ffmpeg_location': ffmpeg_location,
            }
            expected_ext = 'mp4'
        
        logger.info(f"Starting download for URL: {url} with quality: {quality}")
        
        # Download video
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=True)
            filename = ydl.prepare_filename(info)
            
            # If audio extraction, update filename
            if quality == 'audio':
                base_filename = filename.rsplit('.', 1)[0]
                filename = base_filename + '.mp3'
            
            logger.info(f"Video downloaded to: {filename}")
            
            # Check if file exists
            if not os.path.exists(filename):
                raise Exception(f"Downloaded file not found: {filename}")
            
            # Get file size
            file_size = os.path.getsize(filename)
            logger.info(f"File size: {file_size} bytes")
            
            if file_size == 0:
                raise Exception("Downloaded file is empty")
            
            # Stream the file
            with open(filename, 'rb') as f:
                chunk_size = 65536  # 64KB chunks
                bytes_sent = 0
                while True:
                    chunk = f.read(chunk_size)
                    if not chunk:
                        break
                    bytes_sent += len(chunk)
                    yield chunk
                
                logger.info(f"Streaming complete. Sent {bytes_sent} bytes")
        
        # Cleanup
        import shutil
        shutil.rmtree(temp_dir, ignore_errors=True)
        logger.info("Cleanup complete")
        
    except Exception as e:
        logger.error(f"Error downloading video: {str(e)}")
        import shutil
        shutil.rmtree(temp_dir, ignore_errors=True)
        raise


@api_router.post("/video/download")
async def download_video(request: DownloadRequest):
    """Download video and stream to user"""
    try:
        # Get video info first to get title
        loop = asyncio.get_event_loop()
        info = await loop.run_in_executor(executor, extract_video_info, request.url)
        
        # Determine file extension and content type
        if request.quality == 'audio':
            ext = 'mp3'
            content_type = 'audio/mpeg'
        else:
            ext = 'mp4'
            content_type = 'video/mp4'
        
        # Clean filename - remove all non-ASCII characters
        import re
        safe_title = info['title']
        # Remove special characters but keep spaces, dashes and underscores
        safe_title = re.sub(r'[^\w\s-]', '', safe_title, flags=re.UNICODE)
        # Replace multiple spaces with single space
        safe_title = re.sub(r'\s+', ' ', safe_title)
        # Convert to ASCII-safe filename
        safe_title = safe_title.encode('ascii', 'ignore').decode('ascii')
        safe_title = safe_title.strip()[:100]  # Limit length to 100 chars
        
        if not safe_title:
            safe_title = "video"
        
        filename = f"{safe_title}.{ext}"
        
        # Encode filename for Content-Disposition header (RFC 5987)
        from urllib.parse import quote
        encoded_filename = quote(filename)
        
        # Create streaming response
        return StreamingResponse(
            download_video_generator(request.url, request.quality),
            media_type=content_type,
            headers={
                'Content-Disposition': f"attachment; filename*=UTF-8''{encoded_filename}",
            }
        )
    except Exception as e:
        logger.error(f"Error in download endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/")
async def root():
    return {"message": "Video Downloader API"}


# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
    executor.shutdown(wait=False)