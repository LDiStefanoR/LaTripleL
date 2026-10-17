import Image from "next/image";

type Variant = "header" | "hero" | "showcase" | "footer" | "inline";

const sizes: Record<
  Variant,
  { className: string; width: number; height: number; priority?: boolean }
> = {
  header: {
    className: "h-12 w-auto sm:h-14",
    width: 220,
    height: 220,
    priority: true,
  },
  hero: {
    className: "h-28 w-auto sm:h-36 md:h-44",
    width: 480,
    height: 480,
    priority: true,
  },
  showcase: {
    className:
      "h-auto w-full max-h-[min(52vh,420px)] max-w-[min(100%,420px)]",
    width: 720,
    height: 720,
    priority: true,
  },
  footer: {
    className: "h-14 w-auto",
    width: 180,
    height: 180,
  },
  inline: {
    className: "h-12 w-auto",
    width: 140,
    height: 140,
  },
};

type Props = {
  variant?: Variant;
  className?: string;
};

export function BrandLogo({ variant = "header", className = "" }: Props) {
  const s = sizes[variant];

  if (variant === "header") {
    return (
      <span
        className={`inline-flex h-10 w-10 shrink-0 overflow-hidden rounded-full bg-white ring-1 ring-movipack/15 sm:h-14 sm:w-14 ${className}`}
      >
        <Image
          src="/recursos/logo.jpg"
          alt="La Triple L Minimarket"
          width={s.width}
          height={s.height}
          className="h-full w-full object-cover"
          priority={s.priority}
          sizes="56px"
        />
      </span>
    );
  }

  return (
    <Image
      src="/recursos/logo.jpg"
      alt="La Triple L Minimarket"
      width={s.width}
      height={s.height}
      className={`object-contain ${s.className} ${className}`}
      priority={s.priority}
      sizes={
        variant === "showcase"
          ? "(max-width: 640px) 80vw, 420px"
          : "(max-width: 640px) 160px, 220px"
      }
    />
  );
}
