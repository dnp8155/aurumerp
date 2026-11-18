import React from "react";
import { Globe, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import { useI18n, LANGUAGES } from "@/lib/i18n";

export default function LanguageSwitcher() {
  const { lang, setLang } = useI18n();
  const current = LANGUAGES.find((l) => l.code === lang) || LANGUAGES[0];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1.5 px-2">
          <Globe className="h-4 w-4" />
          <span className="text-xs font-semibold">{current.short}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuLabel>Language / भाषा / ભાષા</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {LANGUAGES.map((l) => (
          <DropdownMenuItem
            key={l.code}
            onClick={() => setLang(l.code)}
            className="cursor-pointer justify-between"
          >
            <span>{l.label}</span>
            {lang === l.code && <Check className="h-4 w-4 text-primary" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}