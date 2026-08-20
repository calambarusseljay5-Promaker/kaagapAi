import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";

export const DEFAULT_SHOWCASE_SLIDES = [
  {
    id: "slide-triple-1",
    title: "Sangguniang Barangay Upper Mingading Leadership & Community",
    items: [
      {
        id: "item-officials-main",
        title: "Barangay Upper Mingading Officials & Leadership",
        tag: "Barangay Officials",
        image: "/showcase/barangay_officials_org_chart.jpg",
        alt: "Hon. Mamerto C. Clarito & Sangguniang Barangay Upper Mingading Officials",
      },
      {
        id: "item-1",
        title: "74th Founding Anniversary Hugyaw Festival 2025",
        tag: "Hugyaw Festival 2025",
        image: "/showcase/hugyaw_festival_2025_anniversary.jpg",
        alt: "74th Founding Anniversary Hugyaw Festival 2025 - Barangay Upper Mingading",
      },
      {
        id: "item-evac",
        title: "Barangay Health, Evacuation & Relief Facility",
        tag: "Health & Emergency Relief",
        image: "/showcase/barangay_evacuation_medical_mission.jpg",
        alt: "Barangay Upper Mingading Evacuation & Health Care Operations",
      },
    ],
  },
  {
    id: "slide-triple-2",
    title: "Public Service, Health Drives & Community Assembly",
    items: [
      {
        id: "item-2",
        title: "Barangay Upper Mingading Community Assembly",
        tag: "General Assembly",
        image: "/showcase/barangay_assembly_covered_court_stage.jpg",
        alt: "Barangay Upper Mingading Assembly on Covered Court Stage",
      },
      {
        id: "item-5",
        title: "Hugyaw Blood Donation & Health Drive",
        tag: "Health & Care Drive",
        image: "/showcase/hugyaw_blood_donation_2025.png",
        alt: "Blood Donation Drive 2025",
      },
      {
        id: "item-6",
        title: "Barangay Community Assistance & Program",
        tag: "Community Outreach",
        image: "/showcase/barangay_officials_community_program.jpg",
        alt: "Barangay Upper Mingading Officials Community Program",
      },
    ],
  },
  {
    id: "slide-triple-3",
    title: "Youth, Celebrations & Community Engagement",
    items: [
      {
        id: "item-3",
        title: "2025 Katipunan ng Kabataan Assembly",
        tag: "SK Youth Assembly",
        image: "/showcase/sk_katipunan_ng_kabataan_2025.jpg",
        alt: "2025 Katipunan ng Kabataan Assembly - Upper Mingading",
      },
      {
        id: "item-7",
        title: "Hugyaw Festival Community Celebrations",
        tag: "Festival 2025",
        image: "/showcase/hugyaw_festival_2025.png",
        alt: "Hugyaw Festival Celebrations",
      },
      {
        id: "item-8",
        title: "73rd Founding Anniversary Showcase",
        tag: "73rd Anniversary",
        image: "/showcase/hugyaw_festival_73rd.png",
        alt: "73rd Anniversary Celebration",
      },
    ],
  },
];

const BarangayCarousel = ({
  slides = DEFAULT_SHOWCASE_SLIDES,
  autoPlayInterval = 3500,
  className = "",
}) => {
  // Normalize slides so every slide displays 3 items in a minimized collage layout
  const normalizedSlides = React.useMemo(() => {
    if (!slides || slides.length === 0) return DEFAULT_SHOWCASE_SLIDES;

    if (slides[0]?.items && slides[0].items.length === 3) {
      return slides;
    }

    const allItems = [];
    slides.forEach((s) => {
      if (s.items) {
        allItems.push(...s.items);
      } else {
        allItems.push(s);
      }
    });

    const triples = [];
    for (let i = 0; i < allItems.length; i += 3) {
      const group = [allItems[i]];
      if (allItems[i + 1]) group.push(allItems[i + 1]);
      if (allItems[i + 2]) group.push(allItems[i + 2]);

      while (group.length < 3 && allItems.length > 0) {
        group.push(allItems[group.length % allItems.length]);
      }

      triples.push({
        id: `triple-${i}`,
        items: group.map((item, idx) => ({
          id: item.id || `item-${i}-${idx}`,
          title: item.title || "Barangay Showcase",
          tag: item.tag || (idx === 0 ? "Barangay Event" : idx === 1 ? "Community" : "Public Service"),
          image: item.image || item.url || item.src,
          alt: item.alt || item.title || "Barangay Showcase Image",
        })),
      });
    }
    return triples.length > 0 ? triples : DEFAULT_SHOWCASE_SLIDES;
  }, [slides]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [direction, setDirection] = useState(1);
  const timerRef = useRef(null);

  const totalSlides = normalizedSlides.length;

  const nextSlide = useCallback(() => {
    setDirection(1);
    setCurrentIndex((prev) => (prev + 1) % totalSlides);
  }, [totalSlides]);

  const prevSlide = useCallback(() => {
    setDirection(-1);
    setCurrentIndex((prev) => (prev - 1 + totalSlides) % totalSlides);
  }, [totalSlides]);

  const goToSlide = (index) => {
    setDirection(index > currentIndex ? 1 : -1);
    setCurrentIndex(index);
  };

  // Continuous auto-scroll rotation
  useEffect(() => {
    if (totalSlides <= 1 || isPaused) return;

    timerRef.current = setInterval(() => {
      nextSlide();
    }, autoPlayInterval);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [totalSlides, autoPlayInterval, isPaused, nextSlide]);

  const activeSlide = normalizedSlides[currentIndex] || normalizedSlides[0];

  const slideVariants = {
    enter: (dir) => ({
      opacity: 0,
      x: dir > 0 ? 40 : -40,
    }),
    center: {
      zIndex: 1,
      opacity: 1,
      x: 0,
      transition: {
        duration: 0.4,
        ease: "easeInOut",
      },
    },
    exit: (dir) => ({
      zIndex: 0,
      opacity: 0,
      x: dir > 0 ? -40 : 40,
      transition: {
        duration: 0.3,
        ease: "easeInOut",
      },
    }),
  };

  return (
    <div
      className={`relative w-full select-none ${className}`}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* Minimized Thinner & Compact 3-Card Collage Banner */}
      <div className="relative w-full h-[110px] sm:h-[135px] md:h-[155px] lg:h-[165px] rounded-xl bg-gradient-to-r from-[#0B5D3B] via-[#08452B] to-[#042818] border border-emerald-600/40 shadow-md p-1.5 sm:p-2 overflow-hidden flex items-center justify-center">
        
        <AnimatePresence initial={false} custom={direction} mode="wait">
          <motion.div
            key={activeSlide.id || currentIndex}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            className="absolute inset-0 p-1.5 sm:p-2 flex items-center justify-center"
          >
            {/* 3-Image Collage Grid */}
            <div className="grid grid-cols-3 gap-1.5 sm:gap-2 h-full w-full">
              {activeSlide.items.map((item, idx) => (
                <div
                  key={item.id || idx}
                  className="relative h-full w-full rounded-lg sm:rounded-xl overflow-hidden bg-black/40 border border-white/20 shadow-sm flex items-center justify-center group"
                >
                  {/* Blurred Backdrop */}
                  <img
                    src={item.image}
                    alt=""
                    aria-hidden="true"
                    className="absolute inset-0 h-full w-full object-cover blur-md opacity-35 scale-110 pointer-events-none"
                  />

                  {/* Main Crisp Image */}
                  <img
                    src={item.image}
                    alt={item.alt || item.title}
                    className="relative z-1 h-full w-full object-contain sm:object-cover group-hover:scale-104 transition-transform duration-500"
                  />

                  {/* Tag / Badge */}
                  {item.tag && (
                    <span className="absolute top-1 left-1 sm:top-1.5 sm:left-1.5 z-10 px-1.5 py-0.5 rounded-md text-[7.5px] sm:text-[9.5px] font-black uppercase tracking-wider bg-black/80 text-emerald-300 border border-emerald-400/30 backdrop-blur-xs shadow-xs truncate max-w-[90%]">
                      {item.tag}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Previous Button Arrow */}
        <button
          type="button"
          onClick={prevSlide}
          aria-label="Previous slide"
          className="absolute left-1 sm:left-1.5 top-1/2 -translate-y-1/2 z-20 h-6 w-6 sm:h-7 sm:w-7 rounded-full bg-black/60 hover:bg-black/85 text-white flex items-center justify-center transition shadow-md hover:scale-105 active:scale-95 cursor-pointer border border-white/20"
        >
          <ChevronLeft size={14} />
        </button>

        {/* Next Button Arrow */}
        <button
          type="button"
          onClick={nextSlide}
          aria-label="Next slide"
          className="absolute right-1 sm:right-1.5 top-1/2 -translate-y-1/2 z-20 h-6 w-6 sm:h-7 sm:w-7 rounded-full bg-black/60 hover:bg-black/85 text-white flex items-center justify-center transition shadow-md hover:scale-105 active:scale-95 cursor-pointer border border-white/20"
        >
          <ChevronRight size={14} />
        </button>

        {/* Overlay Indicator Circles */}
        <div className="absolute bottom-1.5 left-0 right-0 z-20 flex items-center justify-center pointer-events-auto">
          <div className="flex items-center gap-1 sm:gap-1.5 px-2 py-0.5 rounded-full bg-black/50 backdrop-blur-xs border border-white/20 shadow-md">
            {normalizedSlides.map((slide, idx) => {
              const isActive = idx === currentIndex;
              return (
                <button
                  key={slide.id || idx}
                  type="button"
                  onClick={() => goToSlide(idx)}
                  aria-label={`Go to slide ${idx + 1}`}
                  className={`transition-all duration-200 cursor-pointer rounded-full flex items-center justify-center ${
                    isActive
                      ? "h-2.5 w-2.5 sm:h-3 sm:w-3 bg-white/30 border-2 border-white shadow-md scale-110"
                      : "h-1.5 w-1.5 sm:h-2 sm:w-2 border-2 border-white/70 bg-transparent hover:border-white"
                  }`}
                >
                  {isActive && (
                    <span className="h-1 w-1 sm:h-1 sm:w-1 rounded-full bg-white shadow-xs" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BarangayCarousel;
