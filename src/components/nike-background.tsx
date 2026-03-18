"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

const NIKE_VIDEOS = [
  "/videos/bienvenida-cancha.mp4",
  "/videos/5489581-hd_1280_720_25fps.mp4",
  "/videos/13496966_1280_720_30fps.mp4",
  "/videos/17721495-hd_1920_1080_30fps.mp4",
  "/videos/10349052-hd_720_1366_25fps.mp4",
  "/videos/20488160-hd_720_1280_30fps.mp4"
];

// Optional image backgrounds support; populate with your assets under /public/images/nike/*
const NIKE_IMAGES: string[] = [
  // Example placeholders (add your own in public/images/nike)
  // "/images/nike/bg-1.jpg",
  // "/images/nike/bg-2.jpg",
];

export function NikeBackground() {
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [currentVideo, setCurrentVideo] = useState(0);
  const [currentImage, setCurrentImage] = useState(0);
  const [mode, setMode] = useState<'video' | 'image'>('video');

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted) {
      // Read preferred background mode from localStorage (defaults to video)
      try {
        const saved = localStorage.getItem('nikeBackgroundMode');
        if (saved === 'image') setMode('image');
        else setMode('video');
      } catch {}
    }
  }, [mounted]);

  useEffect(() => {
    if (theme === "nike" && mounted && mode === 'video') {
      // Rotate videos every 30 seconds
      const interval = setInterval(() => {
        setCurrentVideo((prev) => (prev + 1) % NIKE_VIDEOS.length);
      }, 30000);

      return () => clearInterval(interval);
    }
  }, [theme, mounted, mode]);

  useEffect(() => {
    if (theme === "nike" && mounted && mode === 'image' && NIKE_IMAGES.length > 0) {
      const interval = setInterval(() => {
        setCurrentImage((prev) => (prev + 1) % NIKE_IMAGES.length);
      }, 30000);
      return () => clearInterval(interval);
    }
  }, [theme, mounted, mode]);

  if (!mounted || theme !== "nike") {
    return null;
  }

  // If mode is image and images exist, render rotating image background
  if (mode === 'image' && NIKE_IMAGES.length > 0) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        className="image-background"
        src={NIKE_IMAGES[currentImage]}
        alt="Nike background"
        key={`img-${currentImage}`}
      />
    );
  }

  // Default: render video background with fallback to image if video fails
  return (
    <video
      className="video-background"
      autoPlay
      muted
      loop
      playsInline
      key={currentVideo}
      onError={() => {
        if (NIKE_IMAGES.length > 0) setMode('image');
      }}
    >
      <source src={NIKE_VIDEOS[currentVideo]} type="video/mp4" />
    </video>
  );
}