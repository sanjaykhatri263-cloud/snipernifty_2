import React, { useEffect, useRef } from 'react';
import { createChart } from 'lightweight-charts';

export default function TradingViewChart({ data, longT, shortT }) {
    const chartContainerRef = useRef();

    useEffect(() => {
        if (!data || data.length === 0) return;

        // 1. Initialize the Chart 
        const chart = createChart(chartContainerRef.current, {
            layout: { 
                background: { type: 'solid', color: 'transparent' }, 
                textColor: '#8892a4' 
            },
            grid: { 
                vertLines: { color: 'rgba(255, 255, 255, 0.05)' }, 
                horzLines: { color: 'rgba(255, 255, 255, 0.05)' } 
            },
            timeScale: { 
                timeVisible: true, 
                secondsVisible: false,
                borderColor: '#2a3042'
            },
            rightPriceScale: {
                borderColor: '#2a3042'
            },
            crosshair: {
                mode: 1, // Magnet mode
                vertLine: { color: '#5a6478', labelBackgroundColor: '#0b0e14' },
                horzLine: { color: '#5a6478', labelBackgroundColor: '#0b0e14' }
            }
        });

        // 2. Create the Price Series (Line chart for now, until we upgrade the backend)
        const lineSeries = chart.addLineSeries({
            color: '#c5ccd8',
            lineWidth: 2,
            crosshairMarkerVisible: true,
            crosshairMarkerRadius: 4,
        });

        // 3. Format Data
        const sortedData = [...data].reverse(); 
        
        const chartData = sortedData.map(d => {
            const timestamp = new Date(d.time || d.bar_time).getTime();
            return {
                time: Math.floor(timestamp / 1000), 
                value: d.close || d.price,
            };
        });

        lineSeries.setData(chartData);

        // 4. Generate Dynamic AI Signal Markers
        const markers = [];
        sortedData.forEach(d => {
            const time = Math.floor(new Date(d.time || d.bar_time).getTime() / 1000);
            const lp = d.long_prob || d.prob_long;
            const sp = d.short_prob || d.prob_short;

            if (lp >= longT && lp > sp) {
                markers.push({ 
                    time, 
                    position: 'belowBar', 
                    color: '#00e5a0', 
                    shape: 'arrowUp', 
                    text: `BUY ${lp.toFixed(1)}%` 
                });
            } else if (sp >= shortT && sp > lp) {
                markers.push({ 
                    time, 
                    position: 'aboveBar', 
                    color: '#ff4b6e', 
                    shape: 'arrowDown', 
                    text: `SELL ${sp.toFixed(1)}%` 
                });
            }
        });

        lineSeries.setMarkers(markers);
        chart.timeScale().fitContent();

        // 5. Cleanup on unmount
        return () => {
            chart.remove();
        };
    }, [data, longT, shortT]);

    return (
        <div style={{ background: 'rgba(11, 14, 20, 0.5)', border: '1px solid rgba(255, 255, 255, 0.07)', borderRadius: '13px', padding: '16px' }}>
            <div style={{ fontSize: '10px', color: '#5a6478', letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: '12px' }}>
                Interactive Price & Signal Map
            </div>
            <div ref={chartContainerRef} style={{ width: '100%', height: '350px' }} />
        </div>
    );
}
