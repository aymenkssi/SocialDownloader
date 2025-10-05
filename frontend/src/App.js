import { useState, useEffect } from "react";
import "@/App.css";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Download, Loader2, Video, Music, AlertCircle, CheckCircle2, ExternalLink } from "lucide-react";
import AdSenseAd from "@/components/AdSenseAd";
import PayPalDonateButton from "@/components/PayPalDonateButton";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

function App() {
  const [url, setUrl] = useState("");
  const [metadata, setMetadata] = useState(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [selectedQuality, setSelectedQuality] = useState("best");

  const platformIcons = {
    'YouTube': '🎥',
    'TikTok': '🎵',
    'Instagram': '📸',
    'Facebook': '👥',
    'Twitter/X': '🐦',
    'LinkedIn': '💼',
    'Unknown': '📹'
  };

  const qualityOptions = [
    { value: "best", label: "Meilleure qualité (MP4)" },
    { value: "1080p", label: "1080p (Full HD)" },
    { value: "720p", label: "720p (HD)" },
    { value: "480p", label: "480p" },
    { value: "360p", label: "360p" },
    { value: "audio", label: "Audio uniquement (MP3)" }
  ];

  // Charger le script AdSense
  useEffect(() => {
    const script = document.createElement('script');
    script.src = "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-7488746561313974";
    script.async = true;
    script.crossOrigin = "anonymous";
    document.head.appendChild(script);

    return () => {
      // Cleanup
      if (document.head.contains(script)) {
        document.head.removeChild(script);
      }
    };
  }, []);

  // Initialiser les annonces après chargement du script
  useEffect(() => {
    if (window.adsbygoogle && metadata) {
      try {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
      } catch (e) {
        console.error('AdSense error:', e);
      }
    }
  }, [metadata]);

  const handleAnalyze = async () => {
    if (!url.trim()) {
      setError("Veuillez entrer une URL valide");
      return;
    }

    setLoading(true);
    setError("");
    setSuccess("");
    setMetadata(null);

    try {
      const response = await axios.post(`${API}/video/metadata`, { url });
      setMetadata(response.data);
      setSuccess("Vidéo analysée avec succès !");
    } catch (err) {
      setError(err.response?.data?.detail || "Erreur lors de l'analyse de l'URL. Vérifiez que le lien est valide.");
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    setDownloading(true);
    setError("");
    setSuccess("");

    try {
      const response = await axios.post(
        `${API}/video/download`,
        { url, quality: selectedQuality },
        { 
          responseType: 'blob',
          timeout: 120000, // 2 minutes timeout
          validateStatus: function (status) {
            return status >= 200 && status < 300; // Only accept successful responses
          }
        }
      );

      // Check if response is actually a blob and not empty
      if (!response.data || response.data.size === 0) {
        throw new Error("Le fichier téléchargé est vide");
      }

      // Check if response is an error message in JSON format
      if (response.data.type === 'application/json') {
        const text = await response.data.text();
        const errorData = JSON.parse(text);
        throw new Error(errorData.detail || "Erreur lors du téléchargement");
      }

      console.log("Download response size:", response.data.size, "bytes");
      console.log("Content-Type:", response.headers['content-type']);

      // Create blob link to download
      const downloadUrl = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = downloadUrl;
      
      // Extract filename from content-disposition header
      const contentDisposition = response.headers['content-disposition'];
      let filename = 'video.mp4';
      
      if (contentDisposition) {
        // Handle both standard and RFC 5987 format
        const filenameMatch = contentDisposition.match(/filename\*=UTF-8''(.+)|filename="?([^"]+)"?/);
        if (filenameMatch) {
          filename = decodeURIComponent(filenameMatch[1] || filenameMatch[2]);
        }
      }
      
      // Determine extension from quality if needed
      if (selectedQuality === 'audio' && !filename.endsWith('.mp3')) {
        filename = filename.replace(/\.\w+$/, '.mp3');
      } else if (!filename.endsWith('.mp4') && selectedQuality !== 'audio') {
        filename = filename.replace(/\.\w+$/, '.mp4');
      }
      
      console.log("Downloading file:", filename);
      
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      // Clean up
      setTimeout(() => {
        window.URL.revokeObjectURL(downloadUrl);
      }, 100);
      
      setSuccess("Téléchargement terminé !");
    } catch (err) {
      console.error("Download error:", err);
      
      // Try to extract error message from blob if it's JSON
      if (err.response?.data instanceof Blob && err.response.data.type === 'application/json') {
        try {
          const text = await err.response.data.text();
          const errorData = JSON.parse(text);
          setError(errorData.detail || "Erreur lors du téléchargement");
        } catch (e) {
          setError("Erreur lors du téléchargement. Veuillez réessayer.");
        }
      } else {
        setError(err.response?.data?.detail || err.message || "Erreur lors du téléchargement. Veuillez réessayer.");
      }
    } finally {
      setDownloading(false);
    }
  };

  const formatDuration = (seconds) => {
    if (!seconds) return "N/A";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="App">
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
        {/* Header */}
        <header className="border-b bg-white/80 backdrop-blur-md sticky top-0 z-50 shadow-sm">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center">
                  <Video className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                    SocialDownloader
                  </h1>
                  <p className="text-xs text-slate-500">Téléchargez depuis toutes les plateformes</p>
                </div>
              </div>
              
              {/* Bouton donation dans le header */}
              <PayPalDonateButton variant="header" />
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="container mx-auto px-4 py-12 max-w-4xl">
          {/* Hero Section */}
          <div className="text-center mb-12">
            <h2 className="text-4xl md:text-5xl font-bold text-slate-800 mb-4">
              Téléchargez vos vidéos préférées
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              Collez simplement l'URL de votre vidéo et téléchargez-la en quelques secondes. 
              Compatible avec YouTube, TikTok, Instagram, Facebook, Twitter/X et LinkedIn.
            </p>
          </div>

          {/* Supported Platforms */}
          <div className="flex flex-wrap justify-center gap-3 mb-8">
            {Object.entries(platformIcons).filter(([key]) => key !== 'Unknown').map(([platform, icon]) => (
              <Badge key={platform} variant="secondary" className="text-sm py-2 px-4 bg-white shadow-sm">
                <span className="mr-2">{icon}</span>
                {platform}
              </Badge>
            ))}
          </div>

          {/* Input Section */}
          <Card className="mb-8 shadow-lg border-0 bg-white/90 backdrop-blur-sm" data-testid="url-input-card">
            <CardHeader>
              <CardTitle>Entrez l'URL de la vidéo</CardTitle>
              <CardDescription>
                Copiez et collez le lien de votre vidéo depuis n'importe quelle plateforme supportée
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  data-testid="url-input"
                  type="url"
                  placeholder="https://www.youtube.com/watch?v=..."
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleAnalyze()}
                  className="flex-1 text-base"
                />
                <Button 
                  data-testid="analyze-button"
                  onClick={handleAnalyze} 
                  disabled={loading || !url.trim()}
                  className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Analyse...
                    </>
                  ) : (
                    <>
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Analyser
                    </>
                  )}
                </Button>
              </div>

              {/* Error Alert */}
              {error && (
                <Alert variant="destructive" data-testid="error-alert">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {/* Success Alert */}
              {success && (
                <Alert className="bg-green-50 text-green-900 border-green-200" data-testid="success-alert">
                  <CheckCircle2 className="h-4 w-4" />
                  <AlertDescription>{success}</AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          {/* Google AdSense - Entre le formulaire et les métadonnées/instructions */}
          {metadata && (
            <AdSenseAd className="my-8" />
          )}

          {/* Metadata Preview */}
          {metadata && (
            <Card className="shadow-lg border-0 bg-white/90 backdrop-blur-sm mb-8" data-testid="metadata-card">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-2xl mb-2">{metadata.title}</CardTitle>
                    <div className="flex flex-wrap gap-2 text-sm text-slate-600">
                      {metadata.uploader && (
                        <span className="flex items-center gap-1">
                          <Badge variant="outline">{metadata.uploader}</Badge>
                        </span>
                      )}
                      <Badge className="bg-gradient-to-r from-blue-600 to-indigo-600">
                        <span className="mr-1">{platformIcons[metadata.platform] || '📹'}</span>
                        {metadata.platform}
                      </Badge>
                      {metadata.duration && (
                        <Badge variant="secondary">
                          ⏱️ {formatDuration(metadata.duration)}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Thumbnail */}
                {metadata.thumbnail && (
                  <div className="rounded-lg overflow-hidden shadow-md">
                    <img 
                      src={metadata.thumbnail} 
                      alt={metadata.title}
                      className="w-full h-auto"
                      data-testid="video-thumbnail"
                    />
                  </div>
                )}

                {/* Quality Selection */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">
                    Sélectionnez la qualité
                  </label>
                  <Select value={selectedQuality} onValueChange={setSelectedQuality}>
                    <SelectTrigger data-testid="quality-selector">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {qualityOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Download Button */}
                <Button 
                  data-testid="download-button"
                  onClick={handleDownload}
                  disabled={downloading}
                  className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-lg py-6"
                  size="lg"
                >
                  {downloading ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Téléchargement en cours...
                    </>
                  ) : (
                    <>
                      {selectedQuality === 'audio' ? (
                        <Music className="mr-2 h-5 w-5" />
                      ) : (
                        <Download className="mr-2 h-5 w-5" />
                      )}
                      Télécharger
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Instructions */}
          {!metadata && (
            <Card className="mt-8 bg-gradient-to-br from-blue-50 to-indigo-50 border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="text-xl">Comment ça marche ?</CardTitle>
              </CardHeader>
              <CardContent>
                <ol className="space-y-3 text-slate-700">
                  <li className="flex gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white text-sm flex items-center justify-center font-bold">1</span>
                    <span>Copiez l'URL de la vidéo depuis YouTube, TikTok, Instagram ou toute autre plateforme supportée</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white text-sm flex items-center justify-center font-bold">2</span>
                    <span>Collez le lien dans le champ ci-dessus et cliquez sur "Analyser"</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white text-sm flex items-center justify-center font-bold">3</span>
                    <span>Choisissez la qualité souhaitée (vidéo ou audio uniquement)</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white text-sm flex items-center justify-center font-bold">4</span>
                    <span>Cliquez sur "Télécharger" et profitez de votre vidéo !</span>
                  </li>
                </ol>
              </CardContent>
            </Card>
          )}

          {/* Section Donation - Footer */}
          <PayPalDonateButton className="mt-12" showMessage={true} />
        </main>

        {/* Footer */}
        <footer className="border-t bg-white/80 backdrop-blur-md mt-20 py-8">
          <div className="container mx-auto px-4 text-center text-slate-600">
            <p className="text-sm">
              SocialDownloader • Téléchargez vos vidéos préférées en toute simplicité
            </p>
            <p className="text-xs mt-2 text-slate-500">
              Aucune inscription requise • Gratuit
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
}

export default App;