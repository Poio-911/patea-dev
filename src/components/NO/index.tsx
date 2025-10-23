'use client';
import { JerseyPreview } from "../team-builder/jersey-preview";

export type JerseyProps = {
  primaryColor?: string;
  secondaryColor?: string;
  className?: string;
};

// Este componente ahora es un alias para JerseyPreview
export const JerseyIcon = JerseyPreview;
