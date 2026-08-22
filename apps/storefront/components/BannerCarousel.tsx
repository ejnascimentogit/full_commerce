"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Banner } from "@ecommerce/types";

export function BannerCarousel({ banners }: { banners: Banner[] }) {
  const slides = banners.filter((b) => b.active).sort((a, b) => a.order - b.order);
  const [index, setIndex] = useState(0);

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

  return (
    <div className="hidden md:block relative">
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
