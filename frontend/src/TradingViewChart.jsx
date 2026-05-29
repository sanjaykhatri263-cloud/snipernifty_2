import React, { useEffect, useRef, useState } from 'react';
import { createChart } from 'lightweight-charts';

export default function TradingViewChart({ data, longT, shortT }) {
    const chartContainerRef = useRef();
    const macdContainerRef = useRef();
    const [camTF, setCamTF] = useState("15m"); // Toggle between '15m' and '60m' Camarilla bands

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
            upColor: '#00e5a0', downColor: '#ff4b6e', borderVisible: false,
            wickUpColor: '#00e5a0', wickDownColor: '#ff4b6e'
        });

        // 2. Initialize Camarilla Overlays
        const h4Series = chart.addLineSeries({ color: 'rgba(255, 75, 110, 0.5)', lineWidth: 1, lineStyle: 2, title: `H4 (${camTF})` });
        const l4Series = chart.addLineSeries({ color: 'rgba(0, 229, 160, 0.5)', lineWidth: 1, lineStyle: 2, title: `L4 (${camTF})` });

        // 3. Initialize MACD Sub-Chart
        const macdChart = createChart(macdContainerRef.current, {
            layout: { background: { type: 'solid', color: 'transparent' }, textColor: '#8892a4' },
            grid: { vertLines: { color: 'rgba(255, 255, 255, 0.02)' }, horzLines: { color: 'rgba(255, 255, 255, 0.02)' } },
            timeScale: { timeVisible: true, secondsVisible: false, borderColor: '#2a3042' },
            rightPriceScale: { borderColor: '#2a3042' },
            crosshair: { mode: 0 }
        });

        const macdLine = macdChart.addLineSeries({ color: '#2962FF', lineWidth: 1.5, title: "MACD" });
        const signalLine = macdChart.addLineSeries({ color: '#FF6D00', lineWidth: 1.5, title: "Signal" });
        const histSeries = macdChart.addHistogramSeries({ color: '#26a69a' });

        // 4. Synchronize Crosshairs and Zooming between both charts
        chart.timeScale().subscribeVisibleLogicalRangeChange(range => {
            if (range) macdChart.timeScale().setVisibleLogicalRange(range);
        });
        macdChart.timeScale().subscribeVisibleLogicalRangeChange(range => {
            if (range) chart.timeScale().setVisibleLogicalRange(range);
        });

        // 5. Format the Data Payload
        const sortedData = [...data].reverse();
        
        const candleData = [];
        const h4Data = [];
        const l4Data = [];
        const macdData = [];
        const sigData = [];
        const histData = [];
        const markers = [];

        sortedData.forEach(d => {
            // Guard against legacy data without OHLC variables
            if (d.open === undefined) return; 

            const time = Math.floor(new Date(d.time || d.bar_time).getTime() / 1000);
            
            candleData.push({ time, open: d.open, high: d.high, low: d.low, close: d.close });
            
            // Map the selected Camarilla timeframe
            h4Data.push({ time, value: camTF === "15m" ? d.h4_15m : d.h4_60m });
            l4Data.push({ time, value: camTF === "15m" ? d.l4_15m : d.l4_60m });

            // Map MACD variables
            macdData.push({ time, value: d.macd || 0 });
            sigData.push({ time, value: d.macd_signal || 0 });
            histData.push({ 
                time, 
                value: d.macd_hist || 0, 
                color: (d.macd_hist || 0) >= 0 ? 'rgba(38, 166, 154, 0.5)' : 'rgba(255, 82, 82, 0.5)' 
            });

            // Map dynamic Buy/Sell Signals
            const lp = d.long_prob || d.prob_long;
            const sp = d.short_prob || d.prob_short;

            if (lp >= longT && lp > sp) {
                markers.push({ time, position: 'belowBar', color: '#00e5a0', shape: 'arrowUp', text: `BUY ${lp.toFixed(1)}%` });
            } else if (sp >= shortT && sp > lp) {
                markers.push({ time, position: 'aboveBar', color: '#ff4b6e', shape: 'arrowDown', text: `SELL ${sp.toFixed(1)}%` });
            }
        });

        candleSeries.setData(candleData);
        h4Series.setData(h4Data);
        l4Series.setData(l4Data);
        
        macdLine.setData(macdData);
        signalLine.setData(sigData);
        histSeries.setData(histData);
        candleSeries.setMarkers(markers);
        
        chart.timeScale().fitContent();
        macdChart.timeScale().fitContent();

        // 6. Cleanup on unmount or toggle
        return () => {
            chart.remove();
            macdChart.remove();
        };
    }, [data, longT, shortT, camTF]);

    return (
        <div style={{ background: 'rgba(11, 14, 20, 0.5)', border: '1px solid rgba(255, 255, 255, 0.07)', borderRadius: '13px', padding: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <div style={{ fontSize: '10px', color: '#5a6478', letterSpacing: '.1em', textTransform: 'uppercase' }}>
                    Nifty Sniper Terminal (Candlesticks & Indicators)
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={() => setCamTF("15m")} style={{ fontSize: '10px', padding: '4px 8px', borderRadius: '4px', background: camTF === "15m" ? "rgba(0,229,160,.2)" : "rgba(255,255,255,.05)", color: camTF === "15m" ? "#00e5a0" : "#c5ccd8", border: 'none', cursor: 'pointer' }}>15m Camarilla</button>
                    <button onClick={() => setCamTF("60m")} style={{ fontSize: '10px', padding: '4px 8px', borderRadius: '4px', background: camTF === "60m" ? "rgba(0,229,160,.2)" : "rgba(255,255,255,.05)", color: camTF === "60m" ? "#00e5a0" : "#c5ccd8", border: 'none', cursor: 'pointer' }}>60m Camarilla</button>
                </div>
            </div>
            
            {/* Main Candlestick Chart */}
            <div ref={chartContainerRef} style={{ width: '100%', height: '350px' }} />
            
            {/* Synced MACD Pane */}
            <div ref={macdContainerRef} style={{ width: '100%', height: '120px', marginTop: '4px' }} />
        </div>
    );
}
