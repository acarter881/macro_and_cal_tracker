import { ExclamationTriangleIcon } from "@heroicons/react/24/outline";

interface RadialProgressProps {
    value: number;
    goal: number;
    color: string; // tailwind color class for stroke
    decimals?: number;
    unit?: string;
}

export function RadialProgress({ value, goal, color, decimals = 0, unit = "" }: RadialProgressProps) {
    const pct = goal > 0 ? Math.min(100, (value / goal) * 100) : 0;
    const radius = 28;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (pct / 100) * circumference;
    const exceeded = goal > 0 && value > goal;

    return (
        <div className="flex flex-col items-center">
            <div className="relative w-20 h-20">
                <svg className="w-20 h-20" viewBox="0 0 64 64">
                    <circle
                        className="text-border-light dark:text-border-dark"
                        strokeWidth="4"
                        stroke="currentColor"
                        fill="transparent"
                        r={radius}
                        cx="32"
                        cy="32"
                    />
                    <circle
                        className={`${color} stroke-current`}
                        strokeWidth="4"
                        strokeLinecap="round"
                        stroke="currentColor"
                        fill="transparent"
                        r={radius}
                        cx="32"
                        cy="32"
                        strokeDasharray={circumference}
                        strokeDashoffset={offset}
                        style={{ transition: 'stroke-dashoffset 0.4s ease' }}
                        transform="rotate(-90 32 32)"
                    />
                </svg>
                {exceeded && (
                    <div className="absolute -top-1 -right-1">
                        <ExclamationTriangleIcon className="h-5 w-5 text-brand-danger" aria-hidden="true" />
                        <span className="sr-only">Goal exceeded</span>
                    </div>
                )}
                <div className="absolute inset-0 flex items-center justify-center text-sm font-bold text-text dark:text-text-light">
                    {value.toFixed(decimals)}{unit}
                </div>
            </div>
            {goal > 0 && (
                <div className="text-xs mt-1 text-text dark:text-text-light">
                    {value.toFixed(decimals)}{unit} / {goal}{unit}
                </div>
            )}
        </div>
    );
}

export default RadialProgress;
