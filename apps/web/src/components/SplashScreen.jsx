
import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import HamburgerSun from '@/components/HamburgerSun.jsx';

const SplashScreen = ({ onComplete }) => {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(onComplete, 500); // Wait for fade out animation
    }, 2000);

    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-background"
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="relative inline-block"
          >
            <img
              src="/LogoDrip-Mundial.png?v=2"
              alt="DRIP Logo"
              className="w-[200px] h-[200px] object-contain relative z-10"
            />
            {/* Sol de Mayo en el GAP entre DRIP y burger */}
            <HamburgerSun
              size={65}
              className="absolute z-20"
              style={{ top: '43%', left: '50%', transform: 'translate(-50%, -50%)' }}
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default SplashScreen;
