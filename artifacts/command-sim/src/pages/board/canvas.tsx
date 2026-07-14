import { useState, useRef, useEffect, useCallback } from "react";
import { useBoardStore, getMapTemplate, EntityTemplate } from "@/lib/game";
import { MapShapeRenderer } from "./map-renderer";
import { RenderedEntity } from "./entity-renderer";
import { ZoneRenderer } from "./zone-renderer";

interface CanvasProps {
  mapTemplateId: string;
}

export function CommandCanvas({ mapTemplateId }: CanvasProps) {
  const board = useBoardStore(s => s.board);
  const selectedIds = useBoardStore(s => s.selectedIds);
  const addEntity = useBoardStore(s => s.addEntity);
  const updateEntity = useBoardStore(s => s.updateEntity);
  const setSelection = useBoardStore(s => s.setSelection);
  const toggleSelection = useBoardStore(s => s.toggleSelection);
  const clearSelection = useBoardStore(s => s.clearSelection);
  const removeEntities = useBoardStore(s => s.removeEntities);
  const undo = useBoardStore(s => s.undo);
  const redo = useBoardStore(s => s.redo);
  const duplicateEntities = useBoardStore(s => s.duplicateEntities);
  
  const mapTemplate = getMapTemplate(mapTemplateId);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Viewport transform
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const [isDraggingCanvas, setIsDraggingCanvas] = useState(false);
  const lastMouse = useRef({ x: 0, y: 0 });
  
  // Marquee selection
  const [marquee, setMarquee] = useState<{ startX: number, startY: number, endX: number, endY: number } | null>(null);

  // Entity dragging
  const [draggingEntityId, setDraggingEntityId] = useState<string | null>(null);

  // Focus on mount to capture keys
  useEffect(() => {
    if (containerRef.current) containerRef.current.focus();
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if inside input/textarea
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;
      
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedIds.length > 0) {
          removeEntities(selectedIds);
        }
      }
      if (e.key === 'z' && (e.ctrlKey || e.metaKey)) {
        if (e.shiftKey) redo();
        else undo();
      }
      if (e.key === 'y' && (e.ctrlKey || e.metaKey)) {
        redo();
      }
      if (e.key === 'd' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        if (selectedIds.length > 0) {
          duplicateEntities(selectedIds);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedIds, removeEntities, undo, redo, duplicateEntities]);

  // Handle zooming
  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      // Zoom
      const zoomSensitivity = 0.001;
      const delta = -e.deltaY * zoomSensitivity;
      setTransform(prev => {
        const newScale = Math.max(0.1, Math.min(5, prev.scale * (1 + delta)));
        // Adjust x/y to zoom into cursor
        // ...simplified zoom centered for now
        return { ...prev, scale: newScale };
      });
    } else {
      // Pan
      setTransform(prev => ({
        ...prev,
        x: prev.x - e.deltaX,
        y: prev.y - e.deltaY
      }));
    }
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (container) {
      container.addEventListener('wheel', handleWheel, { passive: false });
      return () => container.removeEventListener('wheel', handleWheel);
    }
    return undefined;
  }, [handleWheel]);

  // Pointer events for Canvas panning and marquee
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      // Middle click or Alt+Click -> Pan
      setIsDraggingCanvas(true);
      lastMouse.current = { x: e.clientX, y: e.clientY };
      e.currentTarget.setPointerCapture(e.pointerId);
    } else if (e.button === 0) {
      // Left click -> Marquee start
      if (e.target === containerRef.current || (e.target as HTMLElement).id === "board-content") {
        clearSelection();
        const rect = containerRef.current!.getBoundingClientRect();
        // Convert to board coordinates
        const boardX = ((e.clientX - rect.left - transform.x) / transform.scale) / rect.width * 1000;
        const boardY = ((e.clientY - rect.top - transform.y) / transform.scale) / rect.height * 1000;
        setMarquee({ startX: boardX, startY: boardY, endX: boardX, endY: boardY });
        e.currentTarget.setPointerCapture(e.pointerId);
      }
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (isDraggingCanvas) {
      const dx = e.clientX - lastMouse.current.x;
      const dy = e.clientY - lastMouse.current.y;
      setTransform(prev => ({ ...prev, x: prev.x + dx, y: prev.y + dy }));
      lastMouse.current = { x: e.clientX, y: e.clientY };
    } else if (marquee) {
      const rect = containerRef.current!.getBoundingClientRect();
      const boardX = ((e.clientX - rect.left - transform.x) / transform.scale) / rect.width * 1000;
      const boardY = ((e.clientY - rect.top - transform.y) / transform.scale) / rect.height * 1000;
      setMarquee(prev => ({ ...prev!, endX: boardX, endY: boardY }));
    } else if (draggingEntityId) {
      const rect = containerRef.current!.getBoundingClientRect();
      // Snap to grid option:
      let boardX = ((e.clientX - rect.left - transform.x) / transform.scale) / rect.width * 1000;
      let boardY = ((e.clientY - rect.top - transform.y) / transform.scale) / rect.height * 1000;
      
      if (e.shiftKey) { // Simple snap
         boardX = Math.round(boardX / 10) * 10;
         boardY = Math.round(boardY / 10) * 10;
      }
      
      updateEntity(draggingEntityId, { x: Math.max(0, Math.min(1000, boardX)), y: Math.max(0, Math.min(1000, boardY)) });
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    setIsDraggingCanvas(false);
    setDraggingEntityId(null);
    if (marquee) {
      // Select entities in marquee
      const minX = Math.min(marquee.startX, marquee.endX);
      const maxX = Math.max(marquee.startX, marquee.endX);
      const minY = Math.min(marquee.startY, marquee.endY);
      const maxY = Math.max(marquee.startY, marquee.endY);
      
      const inMarquee = board.entities.filter(ent => 
        ent.x >= minX && ent.x <= maxX && ent.y >= minY && ent.y <= maxY
      ).map(e => e.id);
      
      if (inMarquee.length > 0) {
        setSelection(inMarquee);
      }
      setMarquee(null);
    }
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  // Drag and drop from palette
  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault(); // allow drop
    e.dataTransfer.dropEffect = 'copy';
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const templateId = e.dataTransfer.getData('application/nordlys-template');
    if (templateId) {
      const rect = containerRef.current!.getBoundingClientRect();
      const boardX = ((e.clientX - rect.left - transform.x) / transform.scale) / rect.width * 1000;
      const boardY = ((e.clientY - rect.top - transform.y) / transform.scale) / rect.height * 1000;
      addEntity(templateId, Math.max(0, Math.min(1000, boardX)), Math.max(0, Math.min(1000, boardY)));
    }
  };

  return (
    <div 
      ref={containerRef}
      className="w-full h-full bg-[#0a0f18] overflow-hidden relative outline-none select-none"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onDragOver={onDragOver}
      onDrop={onDrop}
      tabIndex={0}
    >
      <div 
        id="board-content"
        className="absolute transform-origin-top-left tactical-grid"
        style={{
          width: '1000px', // Fixed coordinate space mapping
          height: '1000px', // We use % for placement so it scales naturally
          left: '50%',
          top: '50%',
          transform: `translate(calc(-50% + ${transform.x}px), calc(-50% + ${transform.y}px)) scale(${transform.scale})`,
          // Adjust background to be actual board dimensions, mapped to % later
        }}
      >
        <div className="absolute inset-0 bg-background/50 pointer-events-none" />
        
        {/* Render Map Shapes */}
        {mapTemplate.shapes.map((shape, i) => (
          <MapShapeRenderer key={`shape-${i}`} shape={shape} />
        ))}
        
        {/* Render Zones */}
        {board.zones.map(zone => (
          <ZoneRenderer 
            key={zone.id} 
            zone={zone} 
            selected={selectedIds.includes(zone.id)} 
            onPointerDown={(e) => {
               if (e.shiftKey) toggleSelection(zone.id);
               else setSelection([zone.id]);
            }}
          />
        ))}

        {/* Render Entities (filtered by visible layers) */}
        {board.entities
          .filter(e => {
            const layer = board.layers.find(l => l.id === e.layerId);
            return layer ? layer.visible : true;
          })
          .map(entity => (
            <RenderedEntity 
              key={entity.id} 
              entity={entity} 
              selected={selectedIds.includes(entity.id)}
              onPointerDown={(e) => {
                e.stopPropagation();
                if (e.shiftKey) {
                  toggleSelection(entity.id);
                } else {
                  if (!selectedIds.includes(entity.id)) {
                    setSelection([entity.id]);
                  }
                  // Start drag
                  setDraggingEntityId(entity.id);
                }
              }}
            />
          ))}

        {/* Render Marquee */}
        {marquee && (
          <div 
            className="absolute border border-primary/50 bg-primary/10 z-50 pointer-events-none"
            style={{
              left: `${Math.min(marquee.startX, marquee.endX) / 10}%`,
              top: `${Math.min(marquee.startY, marquee.endY) / 10}%`,
              width: `${Math.abs(marquee.endX - marquee.startX) / 10}%`,
              height: `${Math.abs(marquee.endY - marquee.startY) / 10}%`,
            }}
          />
        )}
        
        {board.entities.length === 0 && !marquee && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
            <div className="text-muted-foreground/30 text-2xl font-mono uppercase tracking-widest bg-background/40 px-6 py-4 rounded-xl border border-white/5 backdrop-blur-sm flex flex-col items-center">
              <span>Operational Map</span>
              <span className="text-sm mt-2 font-sans tracking-normal opacity-70 text-center">Drag units from the left palette to begin.<br/>Hold Alt+Click to pan. Scroll to zoom.</span>
            </div>
          </div>
        )}
      </div>

      <div className="absolute bottom-4 right-4 flex gap-2">
        <div className="bg-background/80 px-2 py-1 text-[10px] font-mono text-muted-foreground rounded border border-border backdrop-blur-sm">
          Zoom: {Math.round(transform.scale * 100)}%
        </div>
      </div>
    </div>
  );
}
