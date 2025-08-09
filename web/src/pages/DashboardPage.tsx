import { useEffect, useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { format, subDays, parseISO } from 'date-fns';
import { getHistory } from "../api";
import type { HistoryDay } from "../types";

export function DashboardPage() {
    const [data, setData] = useState<HistoryDay[]>([]);
    const [days, setDays] = useState(7);

    useEffect(() => {
        const fetchHistory = async () => {
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
                        className={`px-3 py-1 rounded ${days === opt ? 'bg-blue-500 text-white' : 'bg-gray-200 dark:bg-gray-700'}`}
                    >
                        Last {opt} Days
                    </button>
                ))}
            </div>
            <div className="card">
                <div className="card-header"><h2 className="font-semibold text-lg dark:text-gray-200">Calorie Trend (Last {days} Days)</h2></div>
                <div className="card-body h-80">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={formattedData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(128, 128, 128, 0.2)" />
                            <XAxis dataKey="date" tick={{ fill: 'currentColor' }} />
                            <YAxis tick={{ fill: 'currentColor' }} />
                            <Tooltip
                                contentStyle={{ backgroundColor: '#333', border: 'none' }}
                                labelStyle={{ color: '#fff' }}
                            />
                            <Legend />
                            <Line type="monotone" dataKey="kcal" stroke="#8884d8" strokeWidth={2} activeDot={{ r: 8 }} />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>
            <div className="card">
                <div className="card-header"><h2 className="font-semibold text-lg dark:text-gray-200">Macro Trend (Last {days} Days)</h2></div>
                <div className="card-body h-80">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={formattedData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(128, 128, 128, 0.2)" />
                            <XAxis dataKey="date" tick={{ fill: 'currentColor' }} />
                            <YAxis tick={{ fill: 'currentColor' }} />
                            <Tooltip
                                contentStyle={{ backgroundColor: '#333', border: 'none' }}
                                labelStyle={{ color: '#fff' }}
                            />
                            <Legend />
                            <Line type="monotone" dataKey="protein" name="Protein (g)" stroke="#82ca9d" strokeWidth={2} activeDot={{ r: 8 }} />
                            <Line type="monotone" dataKey="fat" name="Fat (g)" stroke="#ffc658" strokeWidth={2} activeDot={{ r: 8 }} />
                            <Line type="monotone" dataKey="carb" name="Carbs (g)" stroke="#ff8042" strokeWidth={2} activeDot={{ r: 8 }} />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>
            <div className="card">
                <div className="card-header"><h2 className="font-semibold text-lg dark:text-gray-200">Body Weight Trend (Last {days} Days)</h2></div>
                <div className="card-body h-80">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={formattedData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(128, 128, 128, 0.2)" />
                            <XAxis dataKey="date" tick={{ fill: 'currentColor' }} />
                            <YAxis tick={{ fill: 'currentColor' }} />
                            <Tooltip
                                contentStyle={{ backgroundColor: '#333', border: 'none' }}
                                labelStyle={{ color: '#fff' }}
                            />
                            <Legend />
                            <Line type="monotone" dataKey="weight" name="Weight" stroke="#8884d8" strokeWidth={2} activeDot={{ r: 8 }} />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
}