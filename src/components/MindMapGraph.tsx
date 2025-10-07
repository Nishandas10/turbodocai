"use client";

import React, { useMemo, useEffect, useState, useCallback } from "react";
import ReactFlow, { Background, Controls, useNodesState, useEdgesState, NodeTypes, NodeProps, ReactFlowInstance, EdgeTypes, EdgeProps, BaseEdge, Handle, Position } from "reactflow";
import type { Node, Edge } from "reactflow";
import "reactflow/dist/style.css";
import { hierarchy, tree } from "d3-hierarchy";

interface MindMapStructureNode { title: string; children?: MindMapStructureNode[]; id?: string }
interface MindMapData { root?: MindMapStructureNode }
interface Props { structure: MindMapData | null; loading?: boolean; error?: string | null }

type LayoutMode = "logical" | "logical-left" | "mindmap" | "organization" | "catalog" | "timeline" | "vertical-timeline" | "fishbone";

const COLOR_PALETTES: string[][] = [
	["#6366f1","#8b5cf6","#ec4899","#f59e0b","#10b981","#0ea5e9","#14b8a6","#f43f5e"],
	["#1d4ed8","#9333ea","#db2777","#ea580c","#059669","#0284c7","#0d9488","#dc2626"],
	["#334155","#2563eb","#0891b2","#16a34a","#ca8a04","#dc2626","#9333ea","#4f46e5"],
	["#0ea5e9","#6366f1","#10b981","#f59e0b","#f472b6","#8b5cf6","#ef4444","#84cc16"],
	["#6d28d9","#9333ea","#c026d3","#db2777","#e11d48","#f43f5e","#f59e0b","#0ea5e9"],
];

interface NodeData {
	id: string;
	label: string;
	color?: string;
	depth?: number;
	isRoot?: boolean;
	// interactive callbacks
	onAddChild?: (parentId: string) => void;
	onDelete?: (id: string) => void;
	onRename?: (id: string, title: string) => void;
	editingId?: string | null;
	setEditingId?: (id: string | null) => void;
}
function tint(hex: string | undefined, alpha: number) {
	if (!hex) return `rgba(255,255,255,${alpha})`;
	const h = hex.replace('#', '');
	const bigint = parseInt(h.length === 3 ? h.split('').map(c=>c+c).join('') : h, 16);
	const r = (bigint >> 16) & 255; const g = (bigint >> 8) & 255; const b = bigint & 255;
	return `rgba(${r},${g},${b},${alpha})`;
}

const MindMapNode: React.FC<NodeProps<NodeData>> = ({ id, data, selected }) => {
	const depth = data.depth ?? 0;
	const branchColor = data.color || '#6366f1';
	let background: string; let border: string; let color = '#fff'; let fontWeight = 400; let extraShadow = '';
	if (data.isRoot) {
		background = `linear-gradient(135deg,#111827,#1f2937)`;
		border = '1px solid #1e293b'; color = '#fff'; fontWeight = 600; extraShadow = '0 4px 8px -2px rgba(0,0,0,0.35)';
	} else if (depth === 1) {
		background = branchColor; border = `1px solid ${branchColor}`; color = '#fff'; fontWeight = 500; extraShadow = `0 2px 6px -1px ${tint(branchColor,0.6)}`;
	} else if (depth === 2) {
		background = tint(branchColor, 0.18); border = `1px solid ${tint(branchColor,0.55)}`; fontWeight = 500; color = '#fff';
	} else {
		background = tint(branchColor, 0.10); border = `1px solid ${tint(branchColor,0.4)}`; color = '#fff';
	}
	const editing = data.editingId === id;
	const style: React.CSSProperties = {
		position: 'relative',
		padding: depth === 0 ? 12 : 6,
		borderRadius: depth <= 1 ? 14 : 10,
		background,
		border,
		fontSize: 12,
		fontWeight,
		minWidth: depth === 0 ? 180 : depth === 1 ? 140 : 120,
		textAlign: 'center',
		boxShadow: extraShadow || '0 1px 2px rgba(0,0,0,0.08)',
		lineHeight: 1.25,
		color,
		backdropFilter: depth > 1 ? 'blur(4px)' : undefined,
		WebkitBackdropFilter: depth > 1 ? 'blur(4px)' : undefined,
		transition: 'background .25s, box-shadow .25s, border-color .25s'
	};

	return <div style={style}>
		<Handle type="target" position={Position.Left} style={{ opacity: 0 }} />
		<Handle type="source" position={Position.Right} style={{ opacity: 0 }} />
		{editing ? (
			<input
				autoFocus
				defaultValue={data.label}
				style={{
					background: 'rgba(255,255,255,0.15)',
					outline: 'none',
					border: '1px solid rgba(255,255,255,0.25)',
					borderRadius: 6,
					fontSize: 12,
					padding: '4px 6px',
					width: '100%',
					color: '#fff'
				}}
				onBlur={(e)=>{ data.onRename?.(id, e.target.value.trim()||'Untitled'); data.setEditingId?.(null); }}
				onKeyDown={(e)=>{
					if(e.key==='Enter'){ (e.target as HTMLInputElement).blur(); }
					if(e.key==='Escape'){ data.setEditingId?.(null); }
				}}
			/>
		): data.label}
		{selected && !editing && (
			<div style={{
				position:'absolute',
				top:-34,
				left:'50%',
				transform:'translateX(-50%)',
				background:'rgba(255,255,255,0.9)',
				backdropFilter:'blur(6px)',
				border:'1px solid #cbd5e1',
				borderRadius:8,
				padding:'4px 6px',
				fontSize:11,
				color:'#334155',
				display:'flex',
				gap:6,
				boxShadow:'0 4px 10px -2px rgba(0,0,0,0.15)'
			}}>
				<button title="Add child" style={btnStyle} onClick={()=> data.onAddChild?.(id)}>＋</button>
				<button title="Rename" style={btnStyle} onClick={()=> data.setEditingId?.(id)}>✏️</button>
				{!data.isRoot && <button title="Delete" style={btnStyle} onClick={()=> data.onDelete?.(id)}>🗑️</button>}
			</div>
		)}
	</div>;
};

// small inline button style reused
const btnStyle: React.CSSProperties = {
  background:'transparent',
  border:'none',
  padding:'2px 4px',
  cursor:'pointer',
  fontSize:12,
  lineHeight:1,
};

const CurvedEdge: React.FC<EdgeProps> = ({ id, sourceX, sourceY, targetX, targetY, data }) => {
	const dx = targetX - sourceX;
	const dy = targetY - sourceY;
	const dist = Math.max(Math.hypot(dx, dy), 1);
	const curvature = 0.55;
	const cx1 = sourceX + dx * curvature;
	const cy1 = sourceY + dy * 0.05; // slight vertical easing
	const cx2 = targetX - dx * curvature;
	const cy2 = targetY - dy * 0.05;
	const path = `M ${sourceX},${sourceY} C ${cx1},${cy1} ${cx2},${cy2} ${targetX},${targetY}`;
	const stroke = data?.color || '#64748b';
	return <BaseEdge id={id} path={path} style={{ stroke, strokeWidth: dist < 40 ? 1.5 : 2.5, fill: 'none', strokeLinecap: 'round', filter: 'url(#mindmapEdgeGlow)' }} />;
};

const nodeTypes: NodeTypes = { mindMapNode: MindMapNode };
const edgeTypes: EdgeTypes = { curved: CurvedEdge };

export const MindMapGraph: React.FC<Props> = ({ structure, loading, error }) => {
	const [layoutMode, setLayoutMode] = useState<LayoutMode>("logical");
	const [rf, setRf] = useState<ReactFlowInstance | null>(null);
	const [paletteIndex, setPaletteIndex] = useState(0);
	const [showStyle, setShowStyle] = useState(false);
	const [editingId, setEditingId] = useState<string | null>(null);

	// editable tree state
	const [rootTree, setRootTree] = useState<MindMapStructureNode | null>(null);

	const normalized = useMemo(() => {
		if (!structure?.root) return null;
		let counter = 0;
		const assign = (n: MindMapStructureNode): MindMapStructureNode => ({
			...n,
			id: n.id || `n_${counter++}`,
			children: (n.children || []).map(assign)
		});
		return assign(structure.root);
	}, [structure]);

	useEffect(()=>{ if(normalized) setRootTree(normalized); },[normalized]);

	// helper immutable tree operations
	const updateTree = useCallback((fn:(root: MindMapStructureNode)=>MindMapStructureNode)=>{
		setRootTree(r=> r ? fn(r) : r);
	},[]);

	const addChild = useCallback((parentId: string)=>{
		updateTree(root=>{
			const clone = structuredClone(root) as MindMapStructureNode;
			let counter = 0; // compute unique id suffix by counting existing nodes
			const collect=(n:MindMapStructureNode)=>{ counter++; (n.children||[]).forEach(collect); }; collect(clone);
			const newNode: MindMapStructureNode = { id:`n_${Date.now().toString(36)}_${counter}`, title:'New Node', children:[] };
			const walk=(n:MindMapStructureNode)=>{ if(n.id===parentId){ n.children = [...(n.children||[]), newNode]; return; } (n.children||[]).forEach(walk); }; walk(clone); return clone;
		});
	},[updateTree]);

	const renameNode = useCallback((id:string, title:string)=>{
		updateTree(root=>{ const clone=structuredClone(root) as MindMapStructureNode; const walk=(n:MindMapStructureNode)=>{ if(n.id===id) n.title=title; (n.children||[]).forEach(walk); }; walk(clone); return clone; });
	},[updateTree]);

	const deleteNode = useCallback((id:string)=>{
		updateTree(root=>{ if(root.id===id) return root; const clone=structuredClone(root) as MindMapStructureNode; const prune=(n:MindMapStructureNode)=>{ if(!n.children) return; n.children = n.children.filter(c=>c.id!==id); n.children.forEach(prune); }; prune(clone); return clone; });
	},[updateTree]);

	interface Positioned { id: string; title: string; x: number; y: number; parentId?: string; depth: number; branch?: string }

	function buildLogical(root: MindMapStructureNode, mirror = false): Positioned[] {
		const rootH = hierarchy(root, d => d.children || []);
		const t = tree<MindMapStructureNode>().nodeSize([80, 200])(rootH);
		const nodes: Positioned[] = t.descendants().map(d => {
			const depthDist = d.depth * 220;
			return { id: d.data.id!, title: d.data.title, x: mirror ? -depthDist : depthDist, y: d.x, parentId: d.parent?.data.id, depth: d.depth };
		});
		const minX = Math.min(...nodes.map(n => n.x)); const minY = Math.min(...nodes.map(n => n.y));
		nodes.forEach(n => { n.x = n.x - minX + 80; n.y = n.y - minY + 40; });
		return nodes;
	}
	function buildRadial(root: MindMapStructureNode): Positioned[] {
		const size = (n: MindMapStructureNode): number => 1 + (n.children?.reduce((a, c) => a + size(c), 0) || 0);
		const nodes: Positioned[] = []; const radiusStep = 140;
		const place = (n: MindMapStructureNode, start: number, end: number, depth: number, parentId?: string) => {
			const angle = (start + end) / 2; const r = depth * radiusStep;
			nodes.push({ id: n.id!, title: n.title, x: Math.cos(angle) * r, y: Math.sin(angle) * r, parentId, depth });
			if (!n.children?.length) return; const span = end - start; let acc = start; const tot = n.children.reduce((a,c)=>a+size(c),0);
			n.children.forEach(c=>{ const s=size(c); const portion=span*(s/tot); place(c,acc,acc+portion,depth+1,n.id!); acc+=portion; });
		}; place(root,0,Math.PI*2,0);
		const minX = Math.min(...nodes.map(n => n.x)); const minY = Math.min(...nodes.map(n => n.y));
		nodes.forEach(n=>{ n.x = n.x - minX + 60; n.y = n.y - minY + 60; }); return nodes; }
	function buildOrganization(root: MindMapStructureNode): Positioned[] {
		const hRoot = hierarchy(root,d=>d.children||[]); const t = tree<MindMapStructureNode>().nodeSize([160,120])(hRoot);
		const nodes: Positioned[] = t.descendants().map(d=>({ id:d.data.id!, title:d.data.title, x:d.x, y:d.depth*140, parentId:d.parent?.data.id, depth:d.depth }));
		const minX = Math.min(...nodes.map(n=>n.x)); nodes.forEach(n=>{ n.x = n.x - minX + 80; n.y += 40; }); return nodes; }
	function buildCatalog(root: MindMapStructureNode): Positioned[] {
		const nodes: Positioned[] = []; const colWidth=220; const rowGap=60; nodes.push({ id:root.id!, title:root.title, x:40, y:40, depth:0 });
		(root.children||[]).forEach((c,i)=>{ const colX=40+i*colWidth; nodes.push({ id:c.id!, title:c.title, x:colX, y:140, parentId:root.id, depth:1 }); (c.children||[]).forEach((g,j)=>{ nodes.push({ id:g.id!, title:g.title, x:colX, y:140+100+j*rowGap, parentId:c.id, depth:2 }); }); }); return nodes; }
	function buildTimeline(root: MindMapStructureNode, vertical=false): Positioned[] {
		const events=root.children||[]; const nodes: Positioned[]=[{ id:root.id!, title:root.title, x:40, y:40, depth:0 }]; events.forEach((e,i)=>{ if(!vertical){ nodes.push({ id:e.id!, title:e.title, x:140+i*180, y:140+(i%2===0?-40:60), parentId:root.id, depth:1 }); } else { nodes.push({ id:e.id!, title:e.title, x:140+(i%2===0?-40:60), y:140+i*140, parentId:root.id, depth:1 }); } (e.children||[]).forEach((sub,j)=>{ if(!vertical){ nodes.push({ id:sub.id!, title:sub.title, x:140+i*180, y:140+(i%2===0?-80-j*60:120+j*60), parentId:e.id, depth:2 }); } else { nodes.push({ id:sub.id!, title:sub.title, x:140+(i%2===0?-120-j*60:140+j*60), y:140+i*140, parentId:e.id, depth:2 }); } }); }); return nodes; }
	function buildFishbone(root: MindMapStructureNode): Positioned[] { const nodes: Positioned[]=[]; const spineY=300; nodes.push({ id:root.id!, title:root.title, x:80, y:spineY, depth:0 }); const branches=root.children||[]; let up=0,down=0; const branchSpacing=200, minorSpacing=55; branches.forEach((b,i)=>{ const upward=i%2===0; const offset=upward?-(up++*120):down++*120; const bx=80+(i+1)*branchSpacing; const by=spineY+offset; nodes.push({ id:b.id!, title:b.title, x:bx, y:by, parentId:root.id, depth:1 }); (b.children||[]).forEach((c,j)=>{ const cx=bx+140; const cy=by+(upward?-1:1)*(60+j*minorSpacing); nodes.push({ id:c.id!, title:c.title, x:cx, y:cy, parentId:b.id, depth:2 }); }); }); return nodes; }

	const { nodes: computedNodes, edges: computedEdges } = useMemo(()=>{ if(!rootTree) return { nodes:[] as Node[], edges:[] as Edge[] }; let positioned: Positioned[]=[]; switch(layoutMode){ case"logical": positioned=buildLogical(rootTree,false); break; case"logical-left": positioned=buildLogical(rootTree,true); break; case"mindmap": positioned=buildRadial(rootTree); break; case"organization": positioned=buildOrganization(rootTree); break; case"catalog": positioned=buildCatalog(rootTree); break; case"timeline": positioned=buildTimeline(rootTree,false); break; case"vertical-timeline": positioned=buildTimeline(rootTree,true); break; case"fishbone": positioned=buildFishbone(rootTree); break; default: positioned=buildLogical(rootTree,false); } const map=new Map(positioned.map(p=>[p.id,p] as const)); positioned.forEach(p=>{ if(p.depth>1){ let curr: Positioned | undefined = p; while(curr && curr.depth>1) curr = map.get(curr.parentId!); if(curr && curr.depth===1) p.branch = curr.id; } else if(p.depth===1){ p.branch = p.id; } }); const palette = COLOR_PALETTES[paletteIndex % COLOR_PALETTES.length]; const firstLevel = positioned.filter(p=>p.depth===1); const colorMap = new Map<string,string>(); firstLevel.forEach((b,i)=>colorMap.set(b.id,palette[i%palette.length])); const nodes: Node[] = positioned.map(p=>({ id:p.id, position:{ x:p.x, y:p.y }, data:{ id:p.id, label:p.title, color: p.depth===1? colorMap.get(p.id): colorMap.get(p.branch||''), depth:p.depth, isRoot:p.depth===0, onAddChild:addChild, onDelete:deleteNode, onRename:renameNode, editingId, setEditingId }, type:'mindMapNode' })); const edges: Edge[] = positioned.filter(p=>p.parentId).map((p,i)=>({ id:`e_${i}`, source:p.parentId!, target:p.id, type:'curved', data:{ color: p.depth===1? colorMap.get(p.id): colorMap.get(p.branch||'') } })); return { nodes, edges }; // eslint-disable-next-line react-hooks/exhaustive-deps
},[rootTree, layoutMode, paletteIndex, addChild, deleteNode, renameNode, editingId]);

	const [flowNodes, setFlowNodes, onNodesChange] = useNodesState<Node[]>([]); const [flowEdges, setFlowEdges, onEdgesChange] = useEdgesState<Edge[]>([]);
	// sync when layout or tree changes
	useEffect(()=>{ 
    setFlowNodes(computedNodes); 
    setFlowEdges(computedEdges); 
  },[computedNodes, computedEdges, setFlowNodes, setFlowEdges]);
	useEffect(()=>{ if(rf){ const t=setTimeout(()=> rf.fitView({ padding:0.2 }), 40); return ()=> clearTimeout(t);} },[rf, layoutMode, computedNodes.length]);
	const onInit = useCallback((inst: ReactFlowInstance)=> setRf(inst), []);

	if(error) return <div className="p-4 text-sm text-red-500">{error}</div>;
	if(loading) return <div className="p-4 text-sm text-muted-foreground animate-pulse">Generating mind map...</div>;
	if(!structure) return <div className="p-4 text-sm text-muted-foreground">No structure yet.</div>;

	return <div className="w-full h-full border rounded-xl bg-gradient-to-br from-background via-background to-muted/40 relative overflow-hidden">
		<ReactFlow onInit={onInit} nodes={flowNodes} edges={flowEdges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} nodeTypes={nodeTypes} edgeTypes={edgeTypes} fitView>
			{/* Edge glow filter */}
			<svg style={{position:'absolute', width:0, height:0}}>
				<defs>
					<filter id="mindmapEdgeGlow" x="-50%" y="-50%" width="200%" height="200%">
						<feGaussianBlur in="SourceGraphic" stdDeviation="1.2" result="blur" />
						<feMerge>
							<feMergeNode in="blur" />
							<feMergeNode in="SourceGraphic" />
						</feMerge>
					</filter>
				</defs>
			</svg>
			<Background gap={56} size={1} color="#e2e8f0" />
			<Controls position="bottom-right" />
		</ReactFlow>
		<div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-background/80 backdrop-blur px-3 py-1.5 rounded-full border shadow-sm">
			<button onClick={()=>setShowStyle(s=>!s)} className="text-[11px] px-2 py-1 rounded-md border hover:bg-muted transition">Style</button>
			<button onClick={()=>rf?.fitView({padding:0.2})} className="text-[11px] px-2 py-1 rounded-md border hover:bg-muted">Fit</button>
			<select value={layoutMode} onChange={e=>setLayoutMode(e.target.value as LayoutMode)} className="text-[11px] px-2 py-1 rounded-md border bg-background/90 hover:bg-background focus:bg-background focus:outline-none focus:ring-2 focus:ring-indigo-500 transition shadow-sm appearance-none pr-6 relative">
              <option className="bg-background text-foreground" value="logical">Logical</option>
              <option className="bg-background text-foreground" value="logical-left">Logical (Left)</option>
              <option className="bg-background text-foreground" value="mindmap">Mind Map</option>
              <option className="bg-background text-foreground" value="organization">Org</option>
              <option className="bg-background text-foreground" value="catalog">Catalog</option>
              <option className="bg-background text-foreground" value="timeline">Timeline</option>
              <option className="bg-background text-foreground" value="vertical-timeline">Vertical Timeline</option>
              <option className="bg-background text-foreground" value="fishbone">Fishbone</option>
            </select>
		</div>
		{showStyle && <div className="absolute bottom-20 left-1/2 -translate-x-1/2 w-[520px] max-w-[92%] bg-background/95 backdrop-blur-xl rounded-2xl border shadow-xl p-5">
			<h4 className="text-xs font-semibold mb-3 tracking-wide text-muted-foreground">Style</h4>
			<div className="mb-4">
				<p className="text-[11px] font-medium mb-2 uppercase text-muted-foreground">Color Palette</p>
				<div className="grid grid-cols-5 gap-3">
					{COLOR_PALETTES.map((p,i)=> <button key={i} onClick={()=>setPaletteIndex(i)} className={`flex gap-0.5 p-1 rounded-md border hover:shadow transition ${paletteIndex===i?'ring-2 ring-offset-2 ring-indigo-500':''}`}>{p.slice(0,6).map(c=> <span key={c} style={{background:c}} className="w-3 h-3 rounded-sm" />)}</button>)}
				</div>
			</div>
			<div className="flex justify-end"><button onClick={()=>setShowStyle(false)} className="text-[11px] px-3 py-1 rounded-md border hover:bg-muted">Close</button></div>
		</div>}
	</div>;
};

export default MindMapGraph;
