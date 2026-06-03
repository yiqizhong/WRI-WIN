import { useState } from "react";

import { ChevronRight } from "lucide-react";

import "../styles/writer-welcome-screen.css";
import { WriterPrimaryButton, writerPrimaryButtonMotionEndClassName } from "@/components/writer/writer-primary-button";
import { useWorkspace } from "../workspace-context";

export function WelcomeScreen({ onGo }: { onGo: () => void }) {
  const { userName } = useWorkspace();
  const [fadingOut, setFadingOut] = useState(false);

  function handleGo() {
    setFadingOut(true);
    setTimeout(onGo, 150);
  }

  return (
    <div
      className={`${fadingOut ? "writer-content-fade-out" : ""} flex h-full w-full flex-col items-center justify-center gap-[38px] -translate-y-[24px]`}
    >
      <p className="welcome-item welcome-item--1 writer-home-text text-[42px] font-extralight text-center tracking-[2.5px]">
        {userName ? `Hi ${userName}` : "Hi"}
      </p>
      <p className="welcome-item welcome-item--2 writer-home-text text-[42px] font-extralight text-center tracking-[2.5px]">
        Welcome to the Writer.
      </p>
      <div className="welcome-item welcome-item--3">
        <WriterPrimaryButton
          onClick={handleGo}
          className={`welcome-go-btn w-[100px] px-1.5 py-3 ${writerPrimaryButtonMotionEndClassName}`}
          aria-label="Go"
        >
          <ChevronRight className="size-5" strokeWidth={2} aria-hidden />
        </WriterPrimaryButton>
      </div>
    </div>
  );
}
