import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface CompanyAvatarProps {
  name: string;
}

function colorFromName(name: string) {
  const palette = [
    "#6366F1",
    "#06B6D4",
    "#22C55E",
    "#F59E0B",
    "#EF4444",
    "#A855F7",
  ];

  const index = name
    .split("")
    .reduce((acc, char) => acc + char.charCodeAt(0), 0);

  return palette[index % palette.length];
}

export function CompanyAvatar({ name }: CompanyAvatarProps) {
  const initials = name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const color = colorFromName(name);

  return (
    <Avatar className="h-7 w-7">
      <AvatarFallback
        className="text-[10px] font-semibold text-white"
        style={{ backgroundColor: color }}
      >
        {initials}
      </AvatarFallback>
    </Avatar>
  );
}
