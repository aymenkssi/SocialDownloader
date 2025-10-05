import React from 'react';

const AdSenseAd = ({ className = "", style = {} }) => {
  // En production, utilisez votre vrai slot ID de Google AdSense
  const adSlot = "1234567890"; // Remplacez par votre vrai slot ID
  
  return (
    <div className={`adsense-container ${className}`} style={{ margin: '30px 0', ...style }}>
      <ins
        className="adsbygoogle"
        style={{ display: 'block', textAlign: 'center' }}
        data-ad-client="ca-pub-7488746561313974"
        data-ad-slot={adSlot}
        data-ad-format="auto"
        data-full-width-responsive="true"
      ></ins>
    </div>
  );
};

export default AdSenseAd;