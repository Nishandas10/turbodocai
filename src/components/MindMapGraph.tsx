"use client";

import React, { useMemo, useEffect } from "react";
import ReactFlow, { Background, Controls, useNodesState, useEdgesState, NodeTypes, NodeProps, Handle, Position } from "reactflow";
import type { Node, Edge } from "reactflow";
import "reactflow/dist/style.css";
import { hierarchy, tree } from "d3-hierarchy";

interface MindMapStructureNode {
	title: string;
	children?: MindMapStructureNode[];
	id?: string;
}

interface MindMapData { root?: MindMapStructureNode }
interface Props {
	structure: MindMapData | null;
	loading?: boolean;
	error?: string | null;
}

// Custom node component for mind map nodes (kept lean for performance)
const handleStyle: React.CSSProperties = {
	width: 8,
	height: 8,
	background: 'var(--primary)',
	border: '1px solid var(--border)',
};

const MindMapNode: React.FC<NodeProps<{ label: string }>> = ({ data }) => (
	<div
		style={{
			padding: 8,
			borderRadius: 12,
			background: "var(--background)",
			border: "1px solid var(--border)",
			fontSize: 12,
			minWidth: 140,
			textAlign: "center",
			boxShadow: "0 1px 2px rgba(0,0,0,0.08)",
			lineHeight: 1.3,
			position: 'relative'
		}}
	>
		<Handle type="target" position={Position.Top} style={handleStyle} />
		{data.label}
		<Handle type="source" position={Position.Bottom} style={handleStyle} />
	</div>
);

// Stable nodeTypes outside the component to avoid React Flow warning
const nodeTypes: NodeTypes = { mindMapNode: MindMapNode };

export const MindMapGraph: React.FC<Props> = ({ structure, loading, error }) => {
	const { nodes: computedNodes, edges: computedEdges } = useMemo(() => {
		if (!structure?.root) return { nodes: [] as Node[], edges: [] as Edge[] };
		const rootData = structure.root;
		let counter = 0;
		const assign = (n: MindMapStructureNode): MindMapStructureNode => ({
			...n,
			id: n.id || `n_${counter++}`,
			children: (n.children || []).map(assign)
		});
		const cloned = assign(rootData);
		const h = hierarchy(cloned, d => d.children || []);
		const layout = tree<MindMapStructureNode>().nodeSize([140, 160])(h);
		const builtNodes: Node[] = layout.descendants().map(d => ({
			id: d.data.id!,
			position: { x: d.x, y: d.y },
			data: { label: d.data.title },
			type: "mindMapNode"
		}));
		const minX = Math.min(...builtNodes.map(n => n.position.x));
		const minY = Math.min(...builtNodes.map(n => n.position.y));
		builtNodes.forEach(n => { n.position.x -= minX - 80; n.position.y -= minY - 80; });
		const builtEdges: Edge[] = layout.links().map((l, i) => ({
			id: `e_${i}`,
			source: (l.source.data as { id: string }).id,
			target: (l.target.data as { id: string }).id,
			type: "smoothstep"
		}));
		return { nodes: builtNodes, edges: builtEdges };
 	}, [structure]);

	// Initialize state with empty arrays, then update when computation changes
	const [flowNodes, setFlowNodes, onNodesChange] = useNodesState<Node[]>([]);
	const [flowEdges, setFlowEdges, onEdgesChange] = useEdgesState<Edge[]>([]);

	useEffect(() => {
		setFlowNodes(computedNodes);
		setFlowEdges(computedEdges);
	}, [computedNodes, computedEdges, setFlowNodes, setFlowEdges]);

	if (error) return <div className="p-4 text-sm text-red-500">{error}</div>;
	if (loading) return <div className="p-4 text-sm text-muted-foreground animate-pulse">Generating mind map...</div>;
	if (!structure) return <div className="p-4 text-sm text-muted-foreground">No structure yet.</div>;
	return (
		<div className="w-full h-full border rounded-lg bg-card/40 backdrop-blur-sm relative">
			<ReactFlow
				nodes={flowNodes}
				edges={flowEdges}
				onNodesChange={onNodesChange}
				onEdgesChange={onEdgesChange}
				nodeTypes={nodeTypes}
				fitView
			>
				<Background gap={24} size={1} />
				<Controls />
			</ReactFlow>
		</div>
	);
};

export default MindMapGraph;
