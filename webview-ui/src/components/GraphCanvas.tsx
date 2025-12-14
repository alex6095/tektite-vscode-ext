
import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { GraphData, NodeData, EdgeType, NodeType } from '../types';
import { CodeNode } from './CodeNode';
import { EdgeFilters, GraphLayout } from './Toolbar';

interface GraphCanvasProps {
    data: GraphData;
    layoutMode: GraphLayout;
    onNodeSelect: (node: NodeData | null) => void;
    onRunCode: (code: string) => void;
    selectedNodeId: string | null;
    searchQuery: string;
    edgeFilters: EdgeFilters;
}

interface SimulatedNode extends NodeData, d3.SimulationNodeDatum { }
interface SimulatedLink extends d3.SimulationLinkDatum<SimulatedNode> {
    type: EdgeType;
    weight?: number;
}

export const GraphCanvas: React.FC<GraphCanvasProps> = ({
    data,
    layoutMode,
    onNodeSelect,
    onRunCode,
    selectedNodeId,
    searchQuery,
    edgeFilters
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const svgRef = useRef<SVGSVGElement>(null);
    const zoomBehaviorRef = useRef<d3.ZoomBehavior<HTMLDivElement, unknown> | null>(null);

    const [zoomTransform, setZoomTransform] = useState<d3.ZoomTransform>(d3.zoomIdentity);
    const [hoveredNode, setHoveredNode] = useState<NodeData | null>(null);
    const [hoverPos, setHoverPos] = useState({ x: 0, y: 0 });

    const [nodes, setNodes] = useState<SimulatedNode[]>([]);
    const simulationRef = useRef<d3.Simulation<SimulatedNode, SimulatedLink> | null>(null);

    // Filter links for Rendering based on Toggles
    const getRenderableLinks = (allLinks: SimulatedLink[]) => {
        return allLinks.filter(l => {
            if (l.type === EdgeType.SEMANTIC) return edgeFilters.showSemantic;
            return edgeFilters.showStructure;
        });
    };

    useEffect(() => {
        if (!containerRef.current) return;

        const width = containerRef.current.clientWidth;
        const height = containerRef.current.clientHeight;

        // Clone data to avoid mutating props directly
        // If nodes already exist in state (previous tick), use their position to prevent jumping
        const nodesCopy: SimulatedNode[] = data.nodes.map(n => {
            const existing = nodes.find(en => en.id === n.id);
            if (existing) {
                return { ...n, x: existing.x, y: existing.y, vx: existing.vx, vy: existing.vy };
            }
            // Offset new nodes to center of screen immediately
            return {
                ...n,
                x: (n.x ?? 0) + width / 2,
                y: (n.y ?? 0) + height / 2
            };
        });

        const linksCopy: SimulatedLink[] = data.links.map(l => ({ ...l }));

        // Prepare Layout Data (Levels for Flow)
        const levels: Record<string, number> = {};
        if (layoutMode === 'flow') {
            const visited = new Set<string>();
            const roots = nodesCopy.filter(n => n.type === NodeType.MODULE || n.id.includes('main'));
            const queue = roots.map(n => ({ id: n.id, level: 0 }));

            while (queue.length > 0) {
                const { id, level } = queue.shift()!;
                if (visited.has(id)) continue;
                visited.add(id);
                levels[id] = level;

                const outgoing = linksCopy
                    .filter(l => (typeof l.source === 'object' ? l.source.id : l.source) === id)
                    .map(l => (typeof l.target === 'object' ? l.target.id : l.target) as string);

                outgoing.forEach(childId => queue.push({ id: childId, level: level + 1 }));
            }
            nodesCopy.forEach(n => { if (levels[n.id] === undefined) levels[n.id] = 0; });
        }

        // --- PHYSICS CONFIGURATION ---
        let simulationLinks = linksCopy;
        if (layoutMode === 'semantic') {
            // Semantic Mode: Prioritize Semantic edges
            simulationLinks = linksCopy.filter(l => l.type === EdgeType.SEMANTIC || l.type === EdgeType.IMPORTS);
        } else if (layoutMode === 'connection') {
            // Connection Mode: Prioritize structural edges
            simulationLinks = linksCopy.filter(l => l.type !== EdgeType.SEMANTIC);
        }

        const simulation = d3.forceSimulation<SimulatedNode, SimulatedLink>(nodesCopy);

        // Common Forces
        simulation.force('collide', d3.forceCollide().radius(d => (d as any).selected ? 80 : 50).iterations(3));

        if (layoutMode === 'semantic') {
            // --- "BRAIN" MODE ---
            // High density, clustering based on AI similarity.
            // Less repulsion creates a tighter "Organ" feel.
            simulation.force('charge', d3.forceManyBody().strength(-80));
            simulation.force('center', d3.forceCenter(width / 2, height / 2).strength(0.1));

            // Semantic links pull nodes VERY close (Brain Synapses)
            simulation.force('link', d3.forceLink<SimulatedNode, SimulatedLink>(simulationLinks)
                .id(d => d.id)
                .distance(l => l.type === EdgeType.SEMANTIC ? 30 : 120) // Semantic = Tight, Imports = Loose
                .strength(l => l.type === EdgeType.SEMANTIC ? 0.9 : 0.2)
            );

            // Slight radial force to keep the "Brain" spherical
            simulation.force('radial', d3.forceRadial(200, width / 2, height / 2).strength(0.05));

        } else if (layoutMode === 'flow') {
            // --- FLOW MODE ---
            // Hierarchical tree structure
            simulation.force('charge', d3.forceManyBody().strength(-300));
            simulation.force('y', d3.forceY<SimulatedNode>(d => {
                return (levels[d.id] * 250) + 100;
            }).strength(2));
            simulation.force('x', d3.forceX(width / 2).strength(0.08));
            simulation.force('link', d3.forceLink<SimulatedNode, SimulatedLink>(simulationLinks).id(d => d.id).distance(100));

        } else {
            // --- CONNECTION (SOLAR SYSTEM) MODE ---
            // Balanced, spaced out, easy to read structure.
            simulation.force('charge', d3.forceManyBody().strength(-400)); // Strong repulsion for readability
            simulation.force('center', d3.forceCenter(width / 2, height / 2).strength(0.05));

            simulation.force('link', d3.forceLink<SimulatedNode, SimulatedLink>(simulationLinks)
                .id(d => d.id)
                .distance(l => l.type === EdgeType.IMPORTS ? 100 : 200)
                .strength(0.3)
            );

            // Add a Radial Force based on type to create "Orbits"
            // Files on outer ring, Functions in middle/inner
            simulation.force('radial', d3.forceRadial((d: any) => {
                // Main file at center
                if (d.id.includes('main')) return 0;
                // Other files at orbit 350
                if (d.type === NodeType.MODULE || d.type === NodeType.FILE) return 350;
                // Functions floating in between
                return 200;
            }, width / 2, height / 2).strength(0.3));
        }

        // --- Smooth Buoyancy (Floating Effect) ---
        simulation.force('buoyancy', () => {
            const time = performance.now();
            const speed = 0.0002;
            const amplitude = 0.03;

            nodesCopy.forEach((node, i) => {
                const noiseX = Math.sin(time * speed + i) * amplitude;
                const noiseY = Math.cos(time * speed * 0.8 + i) * amplitude;
                node.vx = (node.vx || 0) + noiseX;
                node.vy = (node.vy || 0) + noiseY;
            });
        });

        simulation.velocityDecay(0.6);
        simulation.alphaTarget(0.002);

        simulation.on('tick', () => {
            setNodes([...simulation.nodes()]);
        });

        simulationRef.current = simulation;

        // Initialize Zoom
        const zoom = d3.zoom<HTMLDivElement, unknown>()
            .scaleExtent([0.1, 4])
            .on('zoom', (event) => setZoomTransform(event.transform));

        zoomBehaviorRef.current = zoom;
        d3.select(containerRef.current).call(zoom);

        // Initial Zoom Positioning (Only if transform is default)
        if (layoutMode === 'flow') {
            d3.select(containerRef.current).call(zoom.transform, d3.zoomIdentity.translate(width / 2, 50).scale(0.7).translate(-width / 2, 0));
        } else if (zoomTransform === d3.zoomIdentity) {
            // Center the view with 1.0 scale to show closer initially
            d3.select(containerRef.current).call(zoom.transform, d3.zoomIdentity.translate(width / 2, height / 2).scale(1.0).translate(-width / 2, -height / 2));
        }

        return () => {
            simulation.stop();
        };
    }, [layoutMode, data.links.length, data.nodes.length]);


    // --- Auto-Pan to Selected Node ---
    useEffect(() => {
        if (selectedNodeId && nodes.length > 0 && containerRef.current && zoomBehaviorRef.current) {
            const node = nodes.find(n => n.id === selectedNodeId);
            if (node && node.x && node.y) {
                const width = containerRef.current.clientWidth;
                const height = containerRef.current.clientHeight;

                d3.select(containerRef.current).transition().duration(750).call(
                    zoomBehaviorRef.current.transform,
                    d3.zoomIdentity
                        .translate(width / 2, height / 2)
                        .scale(1.2)
                        .translate(-node.x, -node.y)
                );
            }
        }
    }, [selectedNodeId, nodes.length]);


    // --- Render Links ---
    useEffect(() => {
        if (!svgRef.current || nodes.length === 0) return;
        const svg = d3.select(svgRef.current).select('g.links-layer');

        // 1. Resolve source/target references to node objects
        let resolvedLinks = data.links.map(l => {
            const sourceId = typeof l.source === 'object' ? (l.source as any).id : l.source;
            const targetId = typeof l.target === 'object' ? (l.target as any).id : l.target;
            const source = nodes.find(n => n.id === sourceId);
            const target = nodes.find(n => n.id === targetId);
            return { ...l, source, target };
        }).filter(l => l.source && l.target);

        // 2. Filter based on UI Toggles (Structure vs Semantic)
        const linksToRender = resolvedLinks.filter(l => {
            if (l.type === EdgeType.SEMANTIC) return edgeFilters.showSemantic;
            return edgeFilters.showStructure;
        });

        const isDimmed = (n: NodeData) => searchQuery && !n.label.toLowerCase().includes(searchQuery.toLowerCase());

        // --- DYNAMIC STROKE WIDTH & MARKER SCALING ---
        // Logic: Thinner when zoomed In, Thicker when zoomed Out.
        // Current Scale: zoomTransform.k
        // Formula: BaseWidth / (Scale ^ Factor)

        const currentScale = zoomTransform.k || 1;
        // Base width for structural lines
        const baseStructureWidth = 2.5;
        // Base width for semantic lines
        const baseSemanticWidth = 1.5;

        // Calculate dynamic widths (clamped to avoid disappearing or becoming huge blobs)
        const structureWidth = Math.max(0.5, Math.min(12, baseStructureWidth / Math.pow(currentScale, 0.8)));
        const semanticWidth = Math.max(0.5, Math.min(8, baseSemanticWidth / Math.pow(currentScale, 0.8)));

        // Update Markers to match the new stroke width
        // Since markerUnits="strokeWidth", the marker scales with the line. 
        // We adjust refX to ensure the arrow always touches the node edge (Radius ~34px including gap).
        // refX = DesiredDistance / StrokeWidth
        const targetDistance = 34; // Node radius (30) + Buffer (4)
        d3.select(svgRef.current).selectAll('marker')
            .attr('refX', (d, i, nodes) => {
                // We can't distinguish which marker is for which width easily inside this selection without class/id checks
                // but simplify: Assume markers are for structural lines mainly.
                return targetDistance / structureWidth;
            });

        svg.selectAll('.link')
            .data(linksToRender, (d: any) => `${d.source.id}-${d.target.id}-${d.type}`)
            .join('path')
            .attr('class', 'link')
            .attr('fill', 'none')
            .transition().duration(100) // Smooth transition for width changes
            .attr('stroke-width', (d: any) => {
                let width = d.type === EdgeType.SEMANTIC ? semanticWidth : structureWidth;

                // --- WEIGHT MODIFIER FOR SEMANTIC EDGES ---
                // If it's a semantic edge with a similarity weight (0.75 - 1.0),
                // amplify the width to visualize strong connections.
                if (d.type === EdgeType.SEMANTIC && d.weight) {
                    // Map [0.75, 1.0] -> Multiplier [1x, 4x]
                    // Formula: 1 + (weight - 0.75) * 12
                    // Example: 0.75 -> 1x
                    // Example: 0.90 -> 1 + (0.15 * 12) = 2.8x
                    // Example: 1.00 -> 1 + (0.25 * 12) = 4x
                    const weightFactor = 1 + (d.weight - 0.75) * 12;
                    width *= weightFactor;
                }
                return width;
            })
            .attr('stroke', (d: any) => {
                if (d.type === EdgeType.CALLS) return 'var(--vscode-focusBorder, #6E8FEE)';
                if (d.type === EdgeType.IMPORTS) return 'var(--vscode-terminal-ansiGreen, #4ADE80)';
                if (d.type === EdgeType.SEMANTIC) return 'var(--vscode-textLink-foreground, #A78BFA)';
                return 'var(--vscode-panel-border, #555)';
            })
            .attr('stroke-dasharray', (d: any) => {
                if (d.type === EdgeType.SEMANTIC) {
                    const width = d.weight ? semanticWidth * (1 + (d.weight - 0.75) * 12) : semanticWidth;
                    return `${width * 2},${width * 2}`;
                }
                return 'none';
            })
            .attr('opacity', (d: any) => {
                if (searchQuery) {
                    if (isDimmed(d.source) || isDimmed(d.target)) return 0.1;
                    return 0.8;
                }
                if (d.type === EdgeType.SEMANTIC) {
                    // Higher weight = Higher opacity (0.4 to 0.9)
                    return d.weight ? 0.4 + (d.weight - 0.75) * 2 : 0.7;
                }
                return 0.5; // Slightly clearer structure lines
            })
            .attr('d', (d: any) => {
                // Calculate path
                if (!d.source.x || !d.target.x) return '';
                if (layoutMode === 'flow') {
                    const sx = d.source.x;
                    const sy = d.source.y;
                    const tx = d.target.x;
                    const ty = d.target.y;
                    return `M${sx},${sy} C${sx},${(sy + ty) / 2} ${tx},${(sy + ty) / 2} ${tx},${ty}`;
                } else {
                    const dx = d.target.x - d.source.x;
                    const dy = d.target.y - d.source.y;
                    // Semantic links are straight for tight connection look, Structure links are curved
                    if (d.type === EdgeType.SEMANTIC) return `M${d.source.x},${d.source.y} L${d.target.x},${d.target.y}`;

                    const arcRadius = Math.sqrt(dx * dx + dy * dy) * 2;
                    return `M${d.source.x},${d.source.y}A${arcRadius},${arcRadius} 0 0,1 ${d.target.x},${d.target.y}`;
                }
            })
            .attr('marker-end', (d: any) => {
                if (d.type === EdgeType.SEMANTIC) return null;
                if (searchQuery && (isDimmed(d.source) || isDimmed(d.target))) return null;
                return `url(#arrow-${d.type})`;
            });

    }, [nodes, data.links, searchQuery, layoutMode, edgeFilters, zoomTransform.k]); // Added zoomTransform.k dependency

    const handleMouseMove = (e: React.MouseEvent, node: NodeData) => {
        setHoveredNode(node);
        setHoverPos({ x: e.clientX + 15, y: e.clientY + 15 });
    };

    const handleBgClick = () => { onNodeSelect(null); };

    return (
        <div
            ref={containerRef}
            className="w-full h-full relative overflow-hidden cursor-grab active:cursor-grabbing"
            style={{
                background: `linear-gradient(135deg, 
                    var(--vscode-editor-background) 0%, 
                    color-mix(in srgb, var(--vscode-sideBar-background) 60%, var(--vscode-editor-background)) 50%,
                    var(--vscode-editor-background) 100%)`
            }}
            onClick={handleBgClick}
        >
            {/* Subtle vignette overlay for depth */}
            <div
                className="absolute inset-0 pointer-events-none"
                style={{
                    background: `radial-gradient(ellipse at center, transparent 0%, color-mix(in srgb, var(--vscode-editor-background) 40%, transparent) 100%)`,
                }}
            />
            {/* Grid pattern */}
            <div
                className="absolute inset-0 opacity-30 pointer-events-none"
                style={{
                    backgroundImage: `radial-gradient(circle at 1px 1px, color-mix(in srgb, var(--vscode-editorLineNumber-foreground, var(--vscode-panel-border)) 60%, transparent) 1px, transparent 0)`,
                    backgroundSize: '32px 32px',
                    transform: `translate(${zoomTransform.x}px, ${zoomTransform.y}px) scale(${zoomTransform.k})`,
                    transformOrigin: '0 0'
                }}
            />
            <svg ref={svgRef} className="absolute inset-0 w-full h-full pointer-events-none">
                <defs>
                    {/* Markers refX will be updated dynamically via JS */}
                    <marker id={`arrow-${EdgeType.CALLS}`} viewBox="0 -5 10 10" refX="35" refY="0" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,-5L10,0L0,5" fill="var(--vscode-focusBorder, #6E8FEE)" /></marker>
                    <marker id={`arrow-${EdgeType.IMPORTS}`} viewBox="0 -5 10 10" refX="35" refY="0" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,-5L10,0L0,5" fill="var(--vscode-terminal-ansiGreen, #4ADE80)" /></marker>
                </defs>
                <g className="links-layer" transform={`translate(${zoomTransform.x},${zoomTransform.y}) scale(${zoomTransform.k})`} />
            </svg>

            <div className="absolute inset-0 w-full h-full origin-top-left pointer-events-none" style={{ transform: `translate(${zoomTransform.x}px, ${zoomTransform.y}px) scale(${zoomTransform.k})` }}>
                {nodes.map(node => {
                    const isDimmed = searchQuery && !node.label.toLowerCase().includes(searchQuery.toLowerCase());

                    return (
                        <div
                            key={node.id}
                            className="absolute pointer-events-auto transition-opacity duration-300"
                            style={{
                                left: node.x,
                                top: node.y,
                                opacity: isDimmed ? 0.2 : 1
                            }}
                            onMouseEnter={(e) => handleMouseMove(e, node)}
                            onMouseLeave={() => setHoveredNode(null)}
                            onMouseMove={(e) => setHoverPos({ x: e.clientX + 15, y: e.clientY + 15 })}
                        >
                            <CodeNode
                                data={node}
                                scale={zoomTransform.k}
                                selected={selectedNodeId === node.id}
                                onClick={() => {
                                    if (selectedNodeId === node.id) onNodeSelect(null);
                                    else onNodeSelect(node);
                                }}
                                onRun={onRunCode}
                            />
                        </div>
                    );
                })}
            </div>

            {hoveredNode && hoveredNode.id !== selectedNodeId && (
                <div className="fixed z-50 bg-surface/90 backdrop-blur border border-white/10 p-2.5 rounded-lg shadow-2xl pointer-events-none max-w-xs" style={{ left: hoverPos.x, top: hoverPos.y }}>
                    <div className="flex items-center space-x-2 mb-1">
                        <span className={`w-2 h-2 rounded-full ${hoveredNode.language === 'python' ? 'bg-yellow-400' : 'bg-blue-400'}`} />
                        <h4 className="font-bold text-xs text-gray-100">{hoveredNode.label}</h4>
                    </div>
                    <div className="text-[10px] text-gray-400">{hoveredNode.type}</div>
                </div>
            )}

            <div
                className="absolute bottom-6 left-6 p-4 rounded-xl pointer-events-auto transition-all duration-300 hover:opacity-100 opacity-70 hover:scale-105"
                style={{
                    background: 'color-mix(in srgb, var(--vscode-sideBar-background) 95%, transparent)',
                    backdropFilter: 'blur(16px)',
                    border: '1px solid color-mix(in srgb, var(--vscode-panel-border) 80%, transparent)',
                    boxShadow: '0 8px 32px -8px color-mix(in srgb, black 40%, transparent)'
                }}
            >
                <h3 className="text-xs font-bold uppercase mb-3 tracking-wide" style={{ color: 'var(--vscode-descriptionForeground)' }}>Graph Legend</h3>
                <div className="space-y-2 text-xs" style={{ color: 'var(--vscode-editor-foreground)' }}>
                    <div className="flex items-center">
                        <div className="w-3 h-3 rounded-full mr-2.5 shadow-sm" style={{ background: 'var(--vscode-focusBorder, #6E8FEE)', boxShadow: '0 0 8px color-mix(in srgb, var(--vscode-focusBorder) 50%, transparent)' }}></div>
                        <span style={{ opacity: 0.9 }}>calls (Function Call)</span>
                    </div>
                    <div className="flex items-center">
                        <div className="w-3 h-3 rounded-full mr-2.5 shadow-sm" style={{ background: 'var(--vscode-terminal-ansiGreen, #4ADE80)', boxShadow: '0 0 8px color-mix(in srgb, var(--vscode-terminal-ansiGreen) 50%, transparent)' }}></div>
                        <span style={{ opacity: 0.9 }}>imports (Belongs To)</span>
                    </div>
                    {(layoutMode === 'semantic' || edgeFilters.showSemantic) && (
                        <div className="flex items-center">
                            <div className="w-3 h-3 rounded-full mr-2.5 shadow-sm" style={{ background: 'var(--vscode-textLink-foreground, #A78BFA)', boxShadow: '0 0 8px color-mix(in srgb, var(--vscode-textLink-foreground) 50%, transparent)' }}></div>
                            <span style={{ opacity: 0.9 }}>semantic (AI Similarity)</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
