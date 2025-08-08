"use client";

import React from "react";

interface DebugSliderProps {
  value: number;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

export const DebugSlider: React.FC<DebugSliderProps> = ({ value, onChange }) => {
  return (
    <div className="fixed bottom-4 right-4 z-50 bg-gray-800 bg-opacity-50 p-4 rounded-lg">
      <label htmlFor="intensity" className="block text-white text-sm font-bold mb-2">
        Idle Effect Intensity
      </label>
      <input
        type="range"
        id="intensity"
        name="intensity"
        min="0"
        max="1.5"
        step="0.1"
        value={value}
        onChange={onChange}
        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
      />
    </div>
  );
};