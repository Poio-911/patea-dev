'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { baseNavItems, secondaryNavItems } from './nav-config';

export function DesktopNav() {
    const pathname = usePathname() ?? '';

    return (
        <nav className="hidden md:flex items-center lg:gap-1">
            {/* Primary Items */}
            <div className="flex items-center">
                {baseNavItems.map((item) => (
                    <NavItem
                        key={item.href}
                        href={item.href}
                        label={item.label}
                        pathname={pathname}
                        isActive={pathname.startsWith(item.href)}
                    />
                ))}
            </div>

            {/* Separator for secondary items on large screens */}
            <div className="hidden lg:block w-[1px] h-4 bg-border mx-2" />

            {/* Secondary Items - only shown on large screens to avoid congestion */}
            <div className="hidden lg:flex items-center">
                {secondaryNavItems.map((item) => (
                    <NavItem
                        key={item.href}
                        href={item.href}
                        label={item.label}
                        pathname={pathname}
                    />
                ))}
            </div>

            {/* Overflow menu for secondary items on medium screens could be added here in future */}
        </nav>
    );
}

function NavItem({ href, label, pathname, isActive }: { href: string; label: string; pathname: string; isActive?: boolean }) {
    const active = isActive !== undefined ? isActive : pathname.startsWith(href);
    return (
        <Link
            href={href}
            className={cn(
                "relative px-3 py-2 text-sm font-medium transition-all duration-200 ease-in-out",
                "text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-md xl:px-4",
                "font-headline tracking-tight",
                active && "text-primary font-bold bg-primary/5"
            )}
        >
            {label}
            {active && (
                <motion.div
                    layoutId="desktop-nav-active"
                    className="absolute bottom-0 left-2 right-2 h-[2px] bg-primary rounded-full sm:left-3 sm:right-3"
                    initial={false}
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
            )}
        </Link>
    );
}

import { motion } from 'framer-motion';
