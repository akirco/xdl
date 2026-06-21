import { Text } from "ink";
import type React from "react";
import { useEffect, useState } from "react";

const FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

interface Props {
	label: string;
	color?: string;
}

export const Spinner: React.FC<Props> = ({ label, color = "cyan" }) => {
	const [frame, setFrame] = useState(0);

	useEffect(() => {
		const id = setInterval(() => setFrame((f) => (f + 1) % FRAMES.length), 80);
		return () => clearInterval(id);
	}, []);

	return (
		<Text color={color}>
			{FRAMES[frame]}
			{"  "}
			{label}
		</Text>
	);
};
