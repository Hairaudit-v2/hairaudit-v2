"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";

type ServiceCardProps = {
  title: string;
  shortDesc: string;
  fullDesc: string;
  bullets?: string[];
  href?: string;
  cta?: string;
  image?: { src: string; alt: string };
  images?: { src: string; alt: string }[];
};

export default function ServiceCard({
  title,
  shortDesc,
  fullDesc,
  bullets = [],
  href = "/signup",
  cta = "Request an audit",
  image,
  images,
}: ServiceCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <motion.article
      layout
      className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden"
      whileHover={{ y: -4, boxShadow: "0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)" }}
      transition={{ duration: 0.2 }}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left p-6 sm:p-8 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-inset rounded-2xl"
        type="button"
      >
        {images && images.length >= 2 && (
          <div className="aspect-video grid grid-cols-2 gap-0.5 -mx-6 -mt-6 mb-4 sm:-mx-8 sm:-mt-8 sm:mb-6 overflow-hidden rounded-t-2xl">
            <div className="relative w-full h-full overflow-hidden">
              <Image
                src={images[0].src}
                alt={images[0].alt}
                fill
                sizes="(max-width: 640px) 50vw, 33vw"
                className="object-cover"
              />
            </div>
            <div className="relative w-full h-full overflow-hidden">
              <Image
                src={images[1].src}
                alt={images[1].alt}
                fill
                sizes="(max-width: 640px) 50vw, 33vw"
                className="object-cover"
              />
            </div>
          </div>
        )}
        {image && !images && (
          <div className="relative aspect-video -mx-6 -mt-6 mb-4 sm:-mx-8 sm:-mt-8 sm:mb-6 overflow-hidden rounded-t-2xl">
            <Image
              src={image.src}
              alt={image.alt}
              fill
              sizes="(max-width: 640px) 100vw, 33vw"
              className="object-cover"
            />
          </div>
        )}
        <h2 className="text-xl sm:text-2xl font-semibold text-slate-900 pr-8 flex items-start gap-2">
          <span className="flex-1">{title}</span>
          <motion.span
            animate={{ rotate: expanded ? 180 : 0 }}
            transition={{ duration: 0.2 }}
            className="flex-shrink-0 text-amber-600"
            aria-hidden
          >
            ▼
          </motion.span>
        </h2>
        <p className="mt-3 text-slate-600 text-sm sm:text-base">{shortDesc}</p>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="px-6 pb-6 sm:px-8 sm:pb-8 pt-0 border-t border-slate-100">
              <p className="text-slate-600 text-sm sm:text-base mt-4">{fullDesc}</p>
              {bullets.length > 0 && (
                <ul className="mt-4 space-y-2">
                  {bullets.map((b) => (
                    <li key={b} className="flex gap-2 text-sm sm:text-base text-slate-600">
                      <span className="text-amber-500 flex-shrink-0">•</span>
                      {b}
                    </li>
                  ))}
                </ul>
              )}
              <Link
                href={href}
                className="mt-6 inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-amber-500 text-slate-900 font-semibold text-sm hover:bg-amber-400 transition-colors"
              >
                {cta} →
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.article>
  );
}
