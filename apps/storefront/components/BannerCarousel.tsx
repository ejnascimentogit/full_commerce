"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Banner } from "@ecommerce/types";

export function BannerCarousel({ banners }: { banners: Banner[] }) {
  const slides = banners.filter((b) => b.active).sort((a, b) => a.order - b.order);
  const [index, setIndex] = useState(0);
  const touchStartX = useRef<number | null>(null);

  useEffect(() => {
    if (slides.length < 2) return;
    const timer = setInterval(() => setIndex((i) => (i + 1) % slides.length), 5000);
    return () => clearInterval(timer);
  }, [slides.length]);

  if (slides.length === 0) {
    return <div className="hidden md:block aspect-video bg-brand-50 rounded-2xl" aria-hidden />;
  }

  const slide = slides[index];
  const content = (
    <div className="relative aspect-video rounded-2xl overflow-hidden group">
      {/* eslint-disable-next-line @next/next/no-img-element -- admin-uploaded banner (mock: data URI) */}
      <img src={slide.imageUrl} alt={slide.title ?? "Banner"} className="w-full h-full object-cover" />
      {slide.title && (
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-4">
          <p className="text-white font-semibold text-sm">{slide.title}</p>
        </div>
      )}
    </div>
  );

  // Celular: deslizar o dedo troca de banner.
  const swipe = (endX: number) => {
    if (touchStartX.current === null || slides.length < 2) return;
    const dx = endX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(dx) < 40) return;
    setIndex((i) => (dx < 0 ? (i + 1) % slides.length : (i - 1 + slides.length) % slides.length));
  };

  return (
    // No celular o banner aparece primeiro (antes do texto da página inicial); no computador fica ao lado, como sempre foi.
    <div
      className="relative order-first md:order-none"
      onTouchStart={(e) => (touchStartX.current = e.touches[0].clientX)}
      onTouchEnd={(e) => swipe(e.changedTouches[0].clientX)}
    >
      {slide.linkUrl ? <Link href={slide.linkUrl}>{content}</Link> : content}
      {slides.length > 1 && (
        <div className="absolute bottom-3 right-3 flex gap-1.5">
          {slides.map((s, i) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`Banner ${i + 1}`}
              className={`w-2 h-2 rounded-full ${i === index ? "bg-white" : "bg-white/50"}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
