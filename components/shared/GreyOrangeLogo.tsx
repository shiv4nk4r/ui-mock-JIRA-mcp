interface Props {
  height?: number;
  className?: string;
}

export function GreyOrangeLogo({ height = 28, className }: Props) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/branding/greyorange-logo.svg"
      alt="GreyOrange"
      className={className}
      style={{ height, width: "auto" }}
    />
  );
}
