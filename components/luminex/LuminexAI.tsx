"use client";

import { ArrowUp } from "lucide-react";
import { categoryTags, aiQuestions } from "@/data/luminex-data";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import Image from "next/image";

export function LuminexAI() {
	return (
		<div className="hidden lg:flex lg:w-1/4 flex-col -mt-1 border-l border-primary-body/50 h-full">
			{/* Header */}
			<div className="border-b border-primary-body/50 px-6 flex items-center justify-between">
				<div className="flex items-center gap-2">
					<Image src="/images/luminex/lumi.gif" alt="luminex" width={80} height={80} />
					<span className="font-bold ">LumiNex</span>
				</div>
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<button className="cursor-pointer">
							{/* <Menu size={20} /> */}
							<Image src="/icons/luminex/note.svg" alt="note" width={20} height={20} />
						</button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end">
						<DropdownMenuLabel className="text-lg">February 12, 2026</DropdownMenuLabel>
						{aiQuestions.map((question, idx) => (
							<DropdownMenuItem key={idx} className="cursor-pointer">
								{question}
							</DropdownMenuItem>
						))}
					</DropdownMenuContent>
				</DropdownMenu>
			</div>

			{/* Content */}
			<div className="flex-1 overflow-y-auto p-6 space-y-6">
				{/* Greeting */}
				<div className="space-y-3">
					<div className="flex items-center gap-3">
						<div className="w-11 h-11 bg-purple-100 rounded-full flex items-center justify-center">
							<Image src="/icons/luminex/robot.svg" alt="robot" width={24} height={24} className="-mt-1" />
						</div>
						<div className="border border-primary-blue/50 rounded-xl rounded-tl-md px-3 py-2.5">
							<h6 className="font-medium">Hey! What are you looking for today?</h6>
						</div>
					</div>
				</div>

				{/* Category Tags */}
				<div className="xl:ml-14 ml-10">
					{/* <p className="text-sm text-gray-600 font-medium">Popular searches:</p> */}
					<div className="flex flex-wrap gap-2">
						{categoryTags.map((tag) => (
							<button
								key={tag}
								className="px-3 py-1 border border-primary-body/60 rounded-full text-xs font-medium  hover:border-primary-body transition-colors cursor-pointer"
							>
								{tag}
							</button>
						))}
					</div>
				</div>
			</div>

			{/* Footer */}
			<div className="p-6">
				<div className="space-y-4 p-4 rounded-lg mb-4 shadow-[0_5px_16px_0_rgba(0,0,0,0.3)]">
					{/* Input Field */}
					<div className="relative">
						<input
							type="text"
							placeholder="Ask me anything about products..."
							className="w-full px-4 py-3 border border-primary-body/50 rounded-md text-sm placeholder:text-primary-body focus:outline-none focus:ring-1 focus:ring-purple-600 pr-10"
						/>
						<button className="absolute right-3 top-1/2 -translate-y-1/2 text-primary-black/70 hover:text-gray-600">
							<ArrowUp size={18} />
						</button>
					</div>

					{/* Action Buttons */}
					<div className="flex flex-wrap gap-2">
						<button className=" flex items-center justify-center gap-2 px-2 py-2 border border-primary-body/50 rounded-md text-sm font-medium text-primary-body hover:bg-gray-100 transition-colors">
							<Image src="/icons/luminex/cloud-lightning.svg" alt="cloud" width={18} height={18} />
							Imagine
						</button>
						<button className=" flex items-center justify-center gap-2 px-2 py-2 border border-primary-body/50 rounded-md text-sm font-medium text-primary-body hover:bg-gray-100 transition-colors">
							<Image src="/icons/luminex/bookmark-2.svg" alt="cloud" width={18} height={18} />
							Fav Brands
						</button>
						<button className=" flex items-center justify-center gap-2 px-2 py-2 border border-primary-body/50 rounded-md text-sm font-medium text-primary-body hover:bg-gray-100 transition-colors">
							<Image src="/icons/luminex/people.svg" alt="cloud" width={18} height={18} />
							Group Purchase
						</button>
					</div>
				</div>
			</div>
		</div>
	);
}
