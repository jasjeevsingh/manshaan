/**
 * Drawing Canvas Component
 * 
 * Digital drawing component for VMI assessment items.
 * Uses HTML5 Canvas (no react-canvas-draw due to React 19 conflicts).
 */

import React, { useRef, useState, useCallback, useEffect } from 'react';
import { visionService } from '../../services/api';
import AIDisclaimer from '../compliance/AIDisclaimer';

interface DrawingCanvasProps {
    prompt?: string;
    onSubmit?: (analysis: unknown) => void;
    onCancel?: () => void;
    sessionId?: string;
    itemId?: string;
    taskType?: 'clock' | 'figure_copy' | 'free_draw';
}

export const DrawingCanvas: React.FC<DrawingCanvasProps> = ({
    prompt,
    onSubmit,
    onCancel,
    sessionId,
    itemId,
    taskType = 'free_draw',
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [brushColor, setBrushColor] = useState('#1a365d');
    const [brushSize, setBrushSize] = useState(3);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [analysisResult, setAnalysisResult] = useState<unknown>(null);

    // Initialize canvas
    useEffect(() => {
        const canvas = canvasRef.current;
        if (canvas) {
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.fillStyle = 'white';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
            }
        }
    }, []);

    const getCoordinates = (e: React.MouseEvent | React.TouchEvent): { x: number; y: number } | null => {
        const canvas = canvasRef.current;
        if (!canvas) return null;

        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;

        if ('touches' in e) {
            return {
                x: (e.touches[0].clientX - rect.left) * scaleX,
                y: (e.touches[0].clientY - rect.top) * scaleY,
            };
        }
        return {
            x: (e.clientX - rect.left) * scaleX,
            y: (e.clientY - rect.top) * scaleY,
        };
    };

    const startDrawing = useCallback((e: React.MouseEvent | React.TouchEvent) => {
        const coords = getCoordinates(e);
        if (!coords) return;

        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!ctx) return;

        ctx.beginPath();
        ctx.moveTo(coords.x, coords.y);
        setIsDrawing(true);
    }, []);

    const draw = useCallback((e: React.MouseEvent | React.TouchEvent) => {
        if (!isDrawing) return;

        const coords = getCoordinates(e);
        if (!coords) return;

        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!ctx) return;

        ctx.lineTo(coords.x, coords.y);
        ctx.strokeStyle = brushColor;
        ctx.lineWidth = brushSize;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();
    }, [isDrawing, brushColor, brushSize]);

    const stopDrawing = useCallback(() => {
        setIsDrawing(false);
    }, []);

    const clearCanvas = useCallback(() => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!ctx || !canvas) return;

        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        setAnalysisResult(null);
    }, []);

    const handleSubmit = useCallback(async () => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        setIsAnalyzing(true);

        try {
            // Get base64 image
            const dataUrl = canvas.toDataURL('image/png');
            const base64 = dataUrl.split(',')[1];

            // Call vision API
            const result = await visionService.analyzeDrawing({
                image_base64: base64,
                task_type: taskType,
                session_id: sessionId,
                item_id: itemId,
            });

            setAnalysisResult(result);
            onSubmit?.(result);
        } catch (error) {
            console.error('Vision analysis error:', error);
            setAnalysisResult({ error: 'Analysis failed' });
        } finally {
            setIsAnalyzing(false);
        }
    }, [taskType, sessionId, itemId, onSubmit]);

    const colors = ['#1a365d', '#e53e3e', '#38a169', '#d69e2e', '#805ad5'];
    const sizes = [2, 3, 5, 8];

    return (
        <div className="card">
            <div className="card-header">
                <h4 className="text-lg font-semibold">Drawing Task</h4>
                {prompt && <p className="text-sm text-secondary mt-sm">{prompt}</p>}
            </div>

            <div className="card-body">
                {/* Toolbar */}
                <div className="flex items-center gap-md mb-md flex-wrap">
                    {/* Colors */}
                    <div className="flex items-center gap-sm">
                        <span className="text-sm text-muted">Color:</span>
                        {colors.map((color) => (
                            <button
                                key={color}
                                onClick={() => setBrushColor(color)}
                                className="w-6 h-6 rounded-full border-2 transition-transform hover:scale-110"
                                style={{
                                    backgroundColor: color,
                                    borderColor: brushColor === color ? '#1a365d' : 'transparent',
                                    transform: brushColor === color ? 'scale(1.1)' : 'scale(1)',
                                }}
                            />
                        ))}
                    </div>

                    {/* Sizes */}
                    <div className="flex items-center gap-sm">
                        <span className="text-sm text-muted">Size:</span>
                        {sizes.map((size) => (
                            <button
                                key={size}
                                onClick={() => setBrushSize(size)}
                                className={`w-8 h-8 rounded-md flex items-center justify-center ${brushSize === size ? 'bg-primary text-white' : 'bg-secondary'
                                    }`}
                            >
                                <div
                                    className="rounded-full bg-current"
                                    style={{ width: size * 2, height: size * 2 }}
                                />
                            </button>
                        ))}
                    </div>

                    {/* Clear */}
                    <button className="btn btn-secondary btn-sm" onClick={clearCanvas}>
                        Clear
                    </button>
                </div>

                {/* Canvas */}
                <div className="drawing-canvas-container">
                    <canvas
                        ref={canvasRef}
                        width={600}
                        height={400}
                        onMouseDown={startDrawing}
                        onMouseMove={draw}
                        onMouseUp={stopDrawing}
                        onMouseLeave={stopDrawing}
                        onTouchStart={startDrawing}
                        onTouchMove={draw}
                        onTouchEnd={stopDrawing}
                        style={{
                            width: '100%',
                            height: '400px',
                            cursor: 'crosshair',
                            touchAction: 'none',
                        }}
                    />
                </div>

                {/* Analysis Result */}
                {!!analysisResult && (
                    <div className="mt-md p-md bg-secondary rounded-lg">
                        <p className="text-sm font-medium mb-sm">Analysis Result:</p>
                        <pre className="text-xs overflow-auto">
                            {JSON.stringify(analysisResult as object, null, 2)}
                        </pre>
                    </div>
                )}
            </div>

            <div className="card-footer flex justify-between items-center">
                <AIDisclaimer variant="compact" />

                <div className="flex gap-sm">
                    {onCancel && (
                        <button className="btn btn-secondary" onClick={onCancel}>
                            Cancel
                        </button>
                    )}
                    <button
                        className="btn btn-primary"
                        onClick={handleSubmit}
                        disabled={isAnalyzing}
                    >
                        {isAnalyzing ? (
                            <>
                                <div className="spinner" style={{ width: 16, height: 16 }} />
                                Analyzing...
                            </>
                        ) : (
                            'Submit for Analysis'
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DrawingCanvas;
