import { contactInfo, footerGroups } from "@/lib/data";
import { Instagram, Linkedin, Mail, MapPin, Phone, Send } from "lucide-react";
import Link from "next/link";

const socials = [
  { label: "اینستاگرام", icon: Instagram, href: "#" },
  { label: "تلگرام", icon: Send, href: "#" },
  { label: "لینکدین", icon: Linkedin, href: "#" },
  { label: "ایکس", icon: XIcon, href: "#" },
];

export function Footer() {
  return (
    <footer id="about" className="border-t border-white/[0.06] bg-bg-secondary pt-16 pb-8">
      <div className="container-site">
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-5 lg:gap-8">
          {/* Brand */}
          <div className="sm:col-span-2 lg:col-span-1">
            <Link href="#home" className="inline-flex items-center gap-2.5">
              <FooterLogo />
              <span className="text-[26px] font-extrabold text-text">گرم</span>
            </Link>
            <p className="mt-4 max-w-xs text-[14px] leading-7 text-text-secondary">
              پلتفرم خرید و فروش آنلاین طلا با پشتوانه واقعی، شفافیت کامل و
              تجربه‌ای مدرن برای مدیریت دارایی.
            </p>
            <div className="mt-5 flex items-center gap-2.5">
              {socials.map(({ label, icon: Icon, href }) => (
                <a
                  key={label}
                  href={href}
                  aria-label={label}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-white/[0.08] text-gold transition-all duration-250 hover:-translate-y-0.5 hover:border-gold/40 hover:bg-gold/10"
                >
                  <Icon size={16} strokeWidth={1.5} />
                </a>
              ))}
            </div>
          </div>

          {footerGroups.map((group) => (
            <div key={group.title}>
              <h3 className="mb-4 text-[15px] font-bold text-text">
                {group.title}
              </h3>
              <ul className="space-y-2.5">
                {group.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="link-underline text-[13px] text-text-secondary transition-colors hover:text-gold"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <div id="contact">
            <h3 className="mb-4 text-[15px] font-bold text-text">تماس با ما</h3>
            <ul className="space-y-3.5 text-[13px] text-text-secondary">
              <li className="flex items-start gap-2.5">
                <Phone className="mt-0.5 h-4 w-4 shrink-0 text-gold" strokeWidth={1.5} />
                <span dir="ltr" className="text-right">
                  {contactInfo.phone}
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <Mail className="mt-0.5 h-4 w-4 shrink-0 text-gold" strokeWidth={1.5} />
                <span dir="ltr">{contactInfo.email}</span>
              </li>
              <li className="flex items-start gap-2.5">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-gold" strokeWidth={1.5} />
                <span>{contactInfo.address}</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 border-t border-white/[0.06] pt-6 text-center">
          <p className="text-[12px] text-text-muted">
            تمام حقوق این وب‌سایت متعلق به گرم است.
          </p>
        </div>
      </div>
    </footer>
  );
}

function FooterLogo() {
  return (
    <svg width="30" height="30" viewBox="0 0 34 34" fill="none" aria-hidden>
      <circle cx="17" cy="17" r="15.2" stroke="#D6A84B" strokeWidth="1.4" />
      <path
        d="M17 7.5L19.6 14.1L26.5 14.8L21.2 19.2L22.7 26L17 22.4L11.3 26L12.8 19.2L7.5 14.8L14.4 14.1L17 7.5Z"
        stroke="#F0C568"
        strokeWidth="1.15"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function XIcon({ size = 16, strokeWidth = 1.5 }: { size?: number; strokeWidth?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M4 4l11.5 16H20L8.5 4H4z" />
      <path d="M12.5 11.5L20 20" />
      <path d="M4 4l6.5 6.5" />
    </svg>
  );
}
