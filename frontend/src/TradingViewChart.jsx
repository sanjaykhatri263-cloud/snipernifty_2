import React, { useEffect, useRef, useState } from 'react';
import { createChart } from 'lightweight-charts';

export default function TradingViewChart({ data, longT, shortT }) {
    const chartContainerRef = useRef();
    const probContainerRef = useRef();
    const [camTF, setCamTF] = useState("15m"); 

    useEffect(() => {
        if (!data || data.length === 0) return;

        // 1. Initialize Main Candlestick Chart
        const chart = createChart(chartContainerRef.current, {
            layout: { background: { type: 'solid', color: 'transparent' }, textColor: '#8892a4' },
            grid: { vertLines: { color: 'rgba(255, 255, 255, 0.05)' }, horzLines: { color: 'rgba(255, 255, 255, 0.05)' } },
            timeScale: { timeVisible: true, secondsVisible: false, borderColor: '#2a3042' },
            rightPriceScale: { borderColor: '#2a3042' },
            crosshair: { mode: 0 }
        });

        const candleSeries = chart.addCandlestickSeries({
            upColor: '#00e5a0', downColor: '#ff4b6e', borderVisible: false, wickUpColor: '#00e5a0', wickDownColor: '#ff4b6e'
        });

        const h4Series = chart.addLineSeries({ color: 'rgba(255, 75, 110, 0.5)', lineWidth: 1, lineStyle: 2, title: `H4 (${camTF})` });
        const l4Series = chart.addLineSeries({ color: 'rgba(0, 229, 160, 0.5)', lineWidth: 1, lineStyle: 2, title: `L4 (${camTF})` });

        // 2. Initialize the New Probability & Thresholds Pane
        const probChart = createChart(probContainerRef.current, {
            layout: { background: { type: 'solid', color: 'transparent' }, textColor: '#8892a4' },
            grid: { vertLines: { color: 'rgba(255, 255, 255, 0.02)' }, horzLines: { color: 'rgba(255, 255, 255, 0.02)' } },
            timeScale: { timeVisible: true, secondsVisible: false, borderColor: '#2a3042' },
            rightPriceScale: { borderColor: '#2a3042' },
            crosshair: { mode: 0 }
        });

        const longSeries = probChart.addLineSeries({ color: '#00e5a0', lineWidth: 2, title: "Long %" });
        const shortSeries = probChart.addLineSeries({ color: '#ff4b6e', lineWidth: 2, title: "Short %" });
        const longThreshSeries = probChart.addLineSeries({ color: 'rgba(0, 229, 160, 0.4)', lineWidth: 1, lineStyle: 2, title: "L-Thresh" });
        const shortThreshSeries = probChart.addLineSeries({ color: 'rgba(255, 75, 110, 0.4)', lineWidth: 1, lineStyle: 2, title: "S-Thresh" });

        // Sync Crosshairs
        chart.timeScale().subscribeVisibleLogicalRangeChange(range => { if (range) probChart.timeScale().setVisibleLogicalRange(range); });
        probChart.timeScale().subscribeVisibleLogicalRangeChange(range => { if (range) chart.timeScale().setVisibleLogicalRange(range); });

        // 3. CRASH PREVENTION: Deduplicate and sort strict IST timestamps
        const uniqueMap = new Map();
        data.forEach(d => {
            const timeKey = d.timestamp || d.bar_time || d.time;
            if (timeKey) uniqueMap.set(timeKey, d);
        });
        
        const sortedData = Array.from(uniqueMap.values()).sort((a, b) => {
            return new Date(a.timestamp || a.time).getTime() - new Date(b.timestamp || b.time).getTime();
        });
        
        // 4. Build Payloads
        const candleData = []; const h4Data = []; const l4Data = [];
        const lProbData = []; const sProbData = []; const lThreshData = []; const sThreshData = [];
        const markers = [];

        sortedData.forEach(d => {
            if (d.open === undefined) return; 

            // Safely parse the strict ISO string into UNIX time
            const time = Math.floor(new Date(d.timestamp || d.time).getTime() / 1000);
            
            candleData.push({ time, open: d.open, high: d.high, low: d.low, close: d.close });
            h4Data.push({ time, value: camTF === "15m" ? d.h4_15m : d.h4_60m });
            l4Data.push({ time, value: camTF === "15m" ? d.l4_15m : d.l4_60m });

            const lp = d.long_prob || d.prob_long;
            const sp = d.short_prob || d.prob_short;

            lProbData.push({ time, value: lp });
            sProbData.push({ time, value: sp });
            lThreshData.push({ time, value: longT });
            sThreshData.push({ time, value: shortT });

            if (lp >= longT && lp > sp) {
                markers.push({ time, position: 'belowBar', color: '#00e5a0', shape: 'arrowUp', text: `BUY ${lp.toFixed(1)}%` });
            } else if (sp >= shortT && sp > lp) {
                markers.push({ time, position: 'aboveBar', color: '#ff4b6e', shape: 'arrowDown', text: `SELL ${sp.toFixed(1)}%` });
            }
        });

        candleSeries.setData(candleData);
        h4Series.setData(h4Data);
        l4Series.setData(l4Data);
        candleSeries.setMarkers(markers);

        longSeries.setData(lProbData);
        shortSeries.setData(sProbData);
        longThreshSeries.setData(lThreshData);
        shortThreshSeries.setData(sThreshData);
        
        chart.timeScale().fitContent();
        probChart.timeScale().fitContent();

        return () => { chart.remove(); probChart.remove(); };
    }, [data, longT, shortT, camTF]);

    return (
        <div style={{ background: 'rgba(11, 14, 20, 0.5)', border: '1px solid rgba(255, 255, 255, 0.07)', borderRadius: '13px', padding: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <div style={{ fontSize: '10px', color: '#5a6478', letterSpacing: '.1em', textTransform: 'uppercase' }}>
                    Nifty Sniper Terminal (Candlesticks & AI Probabilities)
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={() => setCamTF("15m")} style={{ fontSize: '10px', padding: '4px 8px', borderRadius: '4px', background: camTF === "15m" ? "rgba(0,229,160,.2)" : "rgba(255,255,255,.05)", color: camTF === "15m" ? "#00e5a0" : "#c5ccd8", border: 'none', cursor: 'pointer' }}>15m Camarilla</button>
                    <button onClick={() => setCamTF("60m")} style={{ fontSize: '10px', padding: '4px 8px', borderRadius: '4px', background: camTF === "60m" ? "rgba(0,229,160,.2)" : "rgba(255,255,255,.05)", color: camTF === "60m" ? "#00e5a0" : "#c5ccd8", border: 'none', cursor: 'pointer' }}>60m Camarilla</button>
                </div>
            </div>
            
            <div ref={chartContainerRef} style={{ width: '100%', height: '350px' }} />
            
            {/* The new Probabilities Pane */}
            <div ref={probContainerRef} style={{ width: '100%', height: '140px', marginTop: '4px' }} />
        </div>
    );
}
