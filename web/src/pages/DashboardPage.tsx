import { useEffect, useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { format, subDays, parseISO } from 'date-fns';
import { getHistory } from "../api";
import type { HistoryDay } from "../types";
import { LoadingSpinner } from "../components/LoadingSpinner";
import { useStore } from "../store";

const palettes = {
    light: {
        grid: 'rgba(0, 0, 0, 0.1)',
        axis: '#333',
        tooltipBg: '#fff',
        tooltipColor: '#000',
        lines: {
            kcal: '#8884d8',
            protein: '#82ca9d',
            fat: '#ffc658',
            carb: '#ff8042',
            weight: '#8884d8',
        },
    },
    dark: {
        grid: 'rgba(255, 255, 255, 0.2)',
        axis: '#ddd',
        tooltipBg: '#333',
        tooltipColor: '#fff',
        lines: {
            kcal: '#8884d8',
            protein: '#82ca9d',
            fat: '#ffc658',
            carb: '#ff8042',
            weight: '#8884d8',
        },
    },
} as const;

export function DashboardPage() {
    const [data, setData] = useState<HistoryDay[]>([]);
    const [days, setDays] = useState(7);
    const [loading, setLoading] = useState(true);
    const theme = useStore(state => state.theme);
    const palette = palettes[theme];

    useEffect(() => {
        const fetchHistory = async () => {
            setLoading(true);
            try {
                const endDate = new Date();
                const startDate = subDays(endDate, days - 1);
                const historyData = await getHistory(
                    format(startDate, 'yyyy-MM-dd'),
                    format(endDate, 'yyyy-MM-dd')
                );
                setData(historyData);
            } catch (error) {
                console.error("Failed to fetch history:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchHistory();
    }, [days]);

    const formattedData = data.map(d => ({ ...d, date: format(parseISO(d.date), days > 7 ? 'MMM dd' : 'E dd') }));

    return (
        <div className="space-y-8">
            <div className="flex gap-2">
                {[7, 30, 90].map(opt => (
                    <button
                        key={opt}
                        onClick={() => setDays(opt)}
                        className={`px-3 py-1 rounded ${days === opt ? 'bg-brand-primary text-text-light' : 'bg-surface-light dark:bg-border-dark'}`}
                    >
                        Last {opt} Days
                    </button>
                ))}
            </div>
            <div className="card">
                <div className="card-header"><h2 className="font-semibold text-lg dark:text-text-light">Calorie Trend (Last {days} Days)</h2></div>
                <div className="card-body h-80">
                    {loading ? (
                        <LoadingSpinner />
                    ) : (
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={formattedData}>
                                <CartesianGrid strokeDasharray="3 3" stroke={palette.grid} />
                                <XAxis dataKey="date" tick={{ fill: palette.axis }} stroke={palette.axis} />
                                <YAxis tick={{ fill: palette.axis }} stroke={palette.axis} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: palette.tooltipBg, border: 'none' }}
                                    labelStyle={{ color: palette.tooltipColor }}
                                    itemStyle={{ color: palette.tooltipColor }}
                                />
                                <Legend wrapperStyle={{ color: palette.axis }} />
                                <Line type="monotone" dataKey="kcal" stroke={palette.lines.kcal} strokeWidth={2} activeDot={{ r: 8 }} />
                            </LineChart>
                        </ResponsiveContainer>
                    )}
                </div>
            </div>
            <div className="card">
                <div className="card-header"><h2 className="font-semibold text-lg dark:text-text-light">Macro Trend (Last {days} Days)</h2></div>
                <div className="card-body h-80">
                    {loading ? (
                        <LoadingSpinner />
                    ) : (
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={formattedData}>
                                <CartesianGrid strokeDasharray="3 3" stroke={palette.grid} />
                                <XAxis dataKey="date" tick={{ fill: palette.axis }} stroke={palette.axis} />
                                <YAxis tick={{ fill: palette.axis }} stroke={palette.axis} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: palette.tooltipBg, border: 'none' }}
                                    labelStyle={{ color: palette.tooltipColor }}
                                    itemStyle={{ color: palette.tooltipColor }}
                                />
                                <Legend wrapperStyle={{ color: palette.axis }} />
                                <Line type="monotone" dataKey="protein" name="Protein (g)" stroke={palette.lines.protein} strokeWidth={2} activeDot={{ r: 8 }} />
                                <Line type="monotone" dataKey="fat" name="Fat (g)" stroke={palette.lines.fat} strokeWidth={2} activeDot={{ r: 8 }} />
                                <Line type="monotone" dataKey="carb" name="Carbs (g)" stroke={palette.lines.carb} strokeWidth={2} activeDot={{ r: 8 }} />
                            </LineChart>
                        </ResponsiveContainer>
                    )}
                </div>
            </div>
            <div className="card">
                <div className="card-header"><h2 className="font-semibold text-lg dark:text-text-light">Body Weight Trend (Last {days} Days)</h2></div>
                <div className="card-body h-80">
                    {loading ? (
                        <LoadingSpinner />
                    ) : (
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={formattedData}>
                                <CartesianGrid strokeDasharray="3 3" stroke={palette.grid} />
                                <XAxis dataKey="date" tick={{ fill: palette.axis }} stroke={palette.axis} />
                                <YAxis tick={{ fill: palette.axis }} stroke={palette.axis} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: palette.tooltipBg, border: 'none' }}
                                    labelStyle={{ color: palette.tooltipColor }}
                                    itemStyle={{ color: palette.tooltipColor }}
                                />
                                <Legend wrapperStyle={{ color: palette.axis }} />
                                <Line type="monotone" dataKey="weight" name="Weight" stroke={palette.lines.weight} strokeWidth={2} activeDot={{ r: 8 }} />
                            </LineChart>
                        </ResponsiveContainer>
                    )}
                </div>
            </div>
        </div>
    );
}