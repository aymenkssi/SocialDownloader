import React from 'react';
import { Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';

const PayPalDonateButton = ({ variant = "default", showMessage = true, className = "" }) => {
  const handleDonateClick = () => {
    window.open('https://paypal.me/survivul', '_blank', 'noopener,noreferrer');
  };

  if (variant === "header") {
    return (
      <Button
        onClick={handleDonateClick}
        data-testid="donate-button-header"
        className={`bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white ${className}`}
        size="sm"
      >
        <Heart className="w-4 h-4 mr-2 fill-current" />
        Faire un don
      </Button>
    );
  }

  return (
    <div className={`donation-section ${className}`} data-testid="donate-section-footer">
      <div className="text-center p-8 bg-gradient-to-br from-pink-50 to-rose-50 rounded-2xl border-2 border-pink-200 shadow-lg">
        {showMessage && (
          <>
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 bg-gradient-to-br from-pink-500 to-rose-500 rounded-full flex items-center justify-center">
                <Heart className="w-8 h-8 text-white fill-current" />
              </div>
            </div>
            <h3 className="text-2xl font-bold text-slate-800 mb-3">
              Soutenez notre projet
            </h3>
            <p className="text-slate-600 mb-6 max-w-md mx-auto">
              Ce service est gratuit et sans publicité intrusive. Si vous trouvez cet outil utile, 
              considérez faire un don pour nous aider à maintenir et améliorer le service.
            </p>
          </>
        )}
        <Button
          onClick={handleDonateClick}
          data-testid="donate-button-footer"
          className="bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white text-lg py-6 px-8"
          size="lg"
        >
          <Heart className="w-5 h-5 mr-2 fill-current" />
          Faire un don via PayPal
        </Button>
        <p className="text-xs text-slate-500 mt-4">
          Chaque contribution compte et est grandement appréciée ! 💖
        </p>
      </div>
    </div>
  );
};

export default PayPalDonateButton;