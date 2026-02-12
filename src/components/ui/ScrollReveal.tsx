"use client";

import { motion } from "framer-motion";

const defaults = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0 },
  transition: { duration: 0.4, ease: "easeOut" as const },
};

export default function ScrollReveal({
  children,
  className,
  delay = 0,
  once = true,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  once?: boolean;
}) {
  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once, margin: "-48px 0px -48px 0px" }}
      variants={{
        hidden: defaults.hidden,
        visible: { ...defaults.visible, transition: { ...defaults.transition, delay } },
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
