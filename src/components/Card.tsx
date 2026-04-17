"use client";

import { ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  padding?: "sm" | "md" | "lg";
}

const paddingMap = {
  sm: "p-4",
  md: "p-5 md:p-6",
  lg: "p-6 md:p-8",
};

export default function Card({
  children,
  className = "",
  hover = false,
  padding = "md",
}: CardProps) {
  return (
    <div
      className={`
        bg-white border border-[#E6EAEB] rounded-2xl ${paddingMap[padding]}
        transition-all duration-150
        ${hover ? "hover:border-[#CFD7D9] hover:shadow-[0_4px_16px_rgba(10,21,25,0.06)]" : ""}
        ${className}
      `}
    >
      {children}
    </div>
  );
}
