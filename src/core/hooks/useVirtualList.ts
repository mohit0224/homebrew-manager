import {
	useState,
	useEffect,
	useLayoutEffect,
	useRef,
	useCallback,
	useMemo,
} from "react";

export type VirtualItemKey = string | number;

export interface VirtualItem {
	key: VirtualItemKey;
	index: number;
	start: number;
	end: number;
	size: number;
	lane: number;
}

export interface VirtualMeasurementRecord {
	key: VirtualItemKey;
	index: number;
	size: number;
}

export interface VirtualScrollSnapshot {
	scrollOffset: number;
	anchorKey: VirtualItemKey | null;
	anchorIndex: number;
	anchorRelativeOffset: number;
	measurements: Record<string, number>;
	timestamp: number;
}

export interface VirtualizerOptions<TScrollElement extends Element | Window = HTMLElement> {
	/** Total number of items in the virtual list */
	count: number;
	/** Function returning the scrollable element (or Window for window scrolling) */
	getScrollElement: () => TScrollElement | null;
	/** Estimated height (in px) for unmeasured items */
	estimateSize: (index: number) => number;
	/** Number of extra items to render above and below the visible viewport */
	overscan?: number;
	/** Stable unique key extractor for each item index */
	getItemKey?: (index: number) => VirtualItemKey;
	/** Vertical gap (in px) between items */
	gap?: number;
	/** Offset from the top of the scroll container to the start of the virtual list */
	scrollMargin?: number;
	/** Padding before the first item (in px) */
	paddingStart?: number;
	/** Padding after the last item (in px) */
	paddingEnd?: number;
	/** Initial scroll offset (or snapshot offset) to restore on mount */
	initialOffset?: number | (() => number);
	/** Optional storage key to automatically persist and restore scroll & measurement snapshots */
	snapshotKey?: string;
	/** Initial cache of item measurements */
	initialMeasurementsCache?: Record<string, number>;
	/** Whether to compensate scroll position when items above viewport resize or prepend */
	shouldAdjustScrollPositionOnItemSizeChange?: (
		item: VirtualItem,
		delta: number,
	) => boolean;
	/** Callback fired whenever scroll offset or virtual state updates */
	onChange?: (instance: VirtualizerInstance) => void;
}

export interface VirtualizerInstance {
	getVirtualItems: () => VirtualItem[];
	getTotalSize: () => number;
	measureElement: (node: Element | null) => void;
	scrollToOffset: (
		offset: number,
		options?: { align?: "start" | "center" | "end" | "auto"; behavior?: ScrollBehavior },
	) => void;
	scrollToIndex: (
		index: number,
		options?: { align?: "start" | "center" | "end" | "auto"; behavior?: ScrollBehavior },
	) => void;
	getSnapshot: () => VirtualScrollSnapshot;
	restoreSnapshot: (snapshot: VirtualScrollSnapshot) => void;
	scrollOffset: number;
	viewportSize: number;
	isScrolling: boolean;
	range: { startIndex: number; endIndex: number } | null;
}

const SNAPSHOT_MEMORY_STORE = new Map<string, VirtualScrollSnapshot>();

export function loadVirtualSnapshot(key: string): VirtualScrollSnapshot | null {
	if (SNAPSHOT_MEMORY_STORE.has(key)) {
		return SNAPSHOT_MEMORY_STORE.get(key) || null;
	}
	if (typeof window !== "undefined" && window.sessionStorage) {
		try {
			const raw = window.sessionStorage.getItem(`virtual_snapshot_${key}`);
			if (raw) {
				const parsed = JSON.parse(raw) as VirtualScrollSnapshot;
				SNAPSHOT_MEMORY_STORE.set(key, parsed);
				return parsed;
			}
		} catch (_e) {
			// Ignore storage parsing errors
		}
	}
	return null;
}

export function saveVirtualSnapshot(key: string, snapshot: VirtualScrollSnapshot): void {
	SNAPSHOT_MEMORY_STORE.set(key, snapshot);
	if (typeof window !== "undefined" && window.sessionStorage) {
		try {
			window.sessionStorage.setItem(
				`virtual_snapshot_${key}`,
				JSON.stringify(snapshot),
			);
		} catch (_e) {
			// Ignore storage quota errors
		}
	}
}

function isWindow(el: unknown): el is Window {
	return typeof window !== "undefined" && el === window;
}

function getElementScrollOffset(el: Element | Window | null): number {
	if (!el) return 0;
	if (isWindow(el)) {
		return window.scrollY || document.documentElement.scrollTop || 0;
	}
	return (el as HTMLElement).scrollTop || 0;
}

function getElementViewportSize(el: Element | Window | null): number {
	if (!el) return 600;
	if (isWindow(el)) {
		return window.innerHeight || 600;
	}
	return (el as HTMLElement).clientHeight || 600;
}

function setElementScrollOffset(
	el: Element | Window | null,
	offset: number,
	behavior: ScrollBehavior = "auto",
): void {
	if (!el) return;
	const clamped = Math.max(0, offset);
	if (isWindow(el)) {
		window.scrollTo({ top: clamped, behavior });
	} else {
		if (behavior === "smooth") {
			(el as HTMLElement).scrollTo({ top: clamped, behavior: "smooth" });
		} else {
			(el as HTMLElement).scrollTop = clamped;
		}
	}
}

function findNearestBinarySearch(
	low: number,
	high: number,
	getValue: (index: number) => number,
	target: number,
): number {
	let l = low;
	let h = high;
	while (l <= h) {
		const mid = (l + h) >>> 1;
		const val = getValue(mid);
		if (val < target) {
			l = mid + 1;
		} else if (val > target) {
			h = mid - 1;
		} else {
			return mid;
		}
	}
	return Math.max(low, l - 1);
}

/**
 * TanStack Virtual-style virtualizer hook for TypeScript & React.
 * Supports element or window scrolling, dynamic ResizeObserver measurement,
 * intentional overscan, stable anchors on prepend/streaming updates,
 * and automatic scroll snapshot restoration.
 */
export function useVirtualizer<TScrollElement extends Element | Window = HTMLElement>(
	options: VirtualizerOptions<TScrollElement>,
): VirtualizerInstance {
	const {
		count,
		getScrollElement,
		estimateSize,
		overscan = 5,
		getItemKey = (index: number) => index,
		gap = 0,
		scrollMargin = 0,
		paddingStart = 0,
		paddingEnd = 0,
		initialOffset,
		snapshotKey,
		initialMeasurementsCache,
		shouldAdjustScrollPositionOnItemSizeChange,
		onChange,
	} = options;

	const savedSnapshot = useMemo(
		() => (snapshotKey ? loadVirtualSnapshot(snapshotKey) : null),
		[snapshotKey],
	);

	// Cache of measured item sizes keyed by stable item key
	const sizeCacheRef = useRef<Map<VirtualItemKey, number>>(new Map());
	const isCacheHydratedRef = useRef(false);

	if (!isCacheHydratedRef.current) {
		isCacheHydratedRef.current = true;
		const source = savedSnapshot?.measurements || initialMeasurementsCache;
		if (source) {
			Object.entries(source).forEach(([k, v]) => {
				if (typeof v === "number" && v > 0) {
					sizeCacheRef.current.set(k, v);
				}
			});
		}
	}

	const resolvedInitialOffset = useMemo(() => {
		if (savedSnapshot && typeof savedSnapshot.scrollOffset === "number") {
			return savedSnapshot.scrollOffset;
		}
		if (typeof initialOffset === "function") {
			return initialOffset();
		}
		return initialOffset ?? 0;
	}, [savedSnapshot, initialOffset]);

	const [scrollOffset, setScrollOffset] = useState<number>(resolvedInitialOffset);
	const [viewportSize, setViewportSize] = useState<number>(600);
	const [isScrolling, setIsScrolling] = useState<boolean>(false);
	const [, setMeasurementVersion] = useState<number>(0);

	const scrollOffsetRef = useRef<number>(resolvedInitialOffset);
	const scrollTimeoutRef = useRef<number | null>(null);
	const hasRestoredSnapshotRef = useRef<boolean>(false);

	// Track previous keys & positions to preserve stable anchors when items prepend or stream
	const prevKeysRef = useRef<VirtualItemKey[]>([]);
	const prevAnchorRef = useRef<{
		key: VirtualItemKey;
		start: number;
	} | null>(null);

	// Compute all item layout metrics (start, end, size, key) in O(N)
	const measurements = useMemo<VirtualItem[]>(() => {
		const items: VirtualItem[] = new Array(count);
		let currentStart = paddingStart;

		for (let i = 0; i < count; i++) {
			const key = getItemKey(i);
			const cachedSize = sizeCacheRef.current.get(key);
			const size =
				typeof cachedSize === "number" && cachedSize > 0
					? cachedSize
					: estimateSize(i);
			const start = currentStart;
			const end = start + size;

			items[i] = {
				key,
				index: i,
				start,
				end,
				size,
				lane: 0,
			};

			currentStart = end + (i < count - 1 ? gap : 0);
		}

		return items;
	}, [count, getItemKey, estimateSize, gap, paddingStart, isScrolling]);

	const totalSize = useMemo(() => {
		if (measurements.length === 0) {
			return paddingStart + paddingEnd;
		}
		return measurements[measurements.length - 1].end + paddingEnd;
	}, [measurements, paddingStart, paddingEnd]);

	// Calculate visible range + intentional overscan using binary search
	const range = useMemo<{ startIndex: number; endIndex: number } | null>(() => {
		if (count === 0 || measurements.length === 0) {
			return null;
		}

		const adjustedOffset = Math.max(0, scrollOffset - scrollMargin);
		const visibleEnd = adjustedOffset + Math.max(1, viewportSize);

		const rawStartIndex = findNearestBinarySearch(
			0,
			measurements.length - 1,
			(idx) => measurements[idx].start,
			adjustedOffset,
		);

		let rawEndIndex = rawStartIndex;
		while (
			rawEndIndex < measurements.length - 1 &&
			measurements[rawEndIndex].end < visibleEnd
		) {
			rawEndIndex++;
		}

		const startIndex = Math.max(0, rawStartIndex - overscan);
		const endIndex = Math.min(measurements.length - 1, rawEndIndex + overscan);

		return { startIndex, endIndex };
	}, [count, measurements, scrollOffset, scrollMargin, viewportSize, overscan]);

	const virtualItems = useMemo<VirtualItem[]>(() => {
		if (!range || measurements.length === 0) {
			return [];
		}
		return measurements.slice(range.startIndex, range.endIndex + 1);
	}, [measurements, range]);

	// Maintain stable scroll anchor when items are prepended at the top
	useLayoutEffect(() => {
		const currentKeys = measurements.map((m) => m.key);
		const prevKeys = prevKeysRef.current;

		if (
			prevKeys.length > 0 &&
			currentKeys.length > prevKeys.length &&
			scrollOffsetRef.current > 0 &&
			prevAnchorRef.current
		) {
			const anchor = prevAnchorRef.current;
			const newIndex = currentKeys.indexOf(anchor.key);
			const oldIndex = prevKeys.indexOf(anchor.key);

			// If items were prepended before the current anchor item, shift scrollTop by the offset delta
			if (newIndex > oldIndex && oldIndex !== -1 && measurements[newIndex]) {
				const delta = measurements[newIndex].start - anchor.start;
				if (Math.abs(delta) > 0.5) {
					const el = getScrollElement();
					const nextOffset = scrollOffsetRef.current + delta;
					scrollOffsetRef.current = nextOffset;
					setElementScrollOffset(el, nextOffset, "auto");
					setScrollOffset(nextOffset);
				}
			}
		}

		prevKeysRef.current = currentKeys;

		// Record the first visible item as the current anchor
		if (measurements.length > 0) {
			const adjustedOffset = Math.max(0, scrollOffsetRef.current - scrollMargin);
			const anchorIdx = findNearestBinarySearch(
				0,
				measurements.length - 1,
				(idx) => measurements[idx].start,
				adjustedOffset,
			);
			const anchorItem = measurements[anchorIdx];
			if (anchorItem) {
				prevAnchorRef.current = {
					key: anchorItem.key,
					start: anchorItem.start,
				};
			}
		}
	}, [measurements, getScrollElement, scrollMargin]);

	// Restore scroll position from snapshot on initial mount
	useLayoutEffect(() => {
		if (hasRestoredSnapshotRef.current || count === 0) return;
		const el = getScrollElement();
		if (!el) return;

		hasRestoredSnapshotRef.current = true;
		let targetOffset = resolvedInitialOffset;

		if (savedSnapshot && savedSnapshot.anchorKey !== null) {
			const anchorItem = measurements.find(
				(m) => m.key === savedSnapshot.anchorKey,
			);
			if (anchorItem) {
				targetOffset = anchorItem.start + savedSnapshot.anchorRelativeOffset;
			}
		}

		if (targetOffset > 0) {
			scrollOffsetRef.current = targetOffset;
			setElementScrollOffset(el, targetOffset, "auto");
			setScrollOffset(targetOffset);
		}
	}, [count, getScrollElement, measurements, resolvedInitialOffset, savedSnapshot]);

	// Attach scroll and viewport resize listeners to the scroll surface
	useEffect(() => {
		const el = getScrollElement();
		if (!el) return;

		const updateViewport = () => {
			setViewportSize(getElementViewportSize(el));
		};

		updateViewport();

		const handleScroll = () => {
			const currentOffset = getElementScrollOffset(el);
			scrollOffsetRef.current = currentOffset;
			setScrollOffset(currentOffset);
			setIsScrolling(true);

			if (scrollTimeoutRef.current !== null) {
				window.clearTimeout(scrollTimeoutRef.current);
			}
			scrollTimeoutRef.current = window.setTimeout(() => {
				setIsScrolling(false);
			}, 150);
		};

		el.addEventListener("scroll", handleScroll, { passive: true });

		let resizeObserver: ResizeObserver | null = null;
		if (!isWindow(el) && typeof ResizeObserver !== "undefined") {
			resizeObserver = new ResizeObserver(updateViewport);
			resizeObserver.observe(el);
		} else {
			window.addEventListener("resize", updateViewport, { passive: true });
		}

		return () => {
			el.removeEventListener("scroll", handleScroll);
			if (resizeObserver) {
				resizeObserver.disconnect();
			} else {
				window.removeEventListener("resize", updateViewport);
			}
			if (scrollTimeoutRef.current !== null) {
				window.clearTimeout(scrollTimeoutRef.current);
			}
		};
	}, [getScrollElement]);

	// Dynamic DOM element measurement with ResizeObserver
	const observedNodesRef = useRef<Map<Element, ResizeObserver>>(new Map());

	const measureNode = useCallback(
		(node: Element) => {
			const indexAttr = node.getAttribute("data-index");
			if (indexAttr === null) return;
			const index = Number(indexAttr);
			if (Number.isNaN(index) || index < 0 || index >= count) return;

			const key = getItemKey(index);
			const rect = node.getBoundingClientRect();
			const measuredHeight = Math.round(rect.height);
			if (measuredHeight <= 0) return;

			const prevSize = sizeCacheRef.current.get(key);
			if (prevSize !== measuredHeight) {
				const item = measurements[index];
				const delta = measuredHeight - (item?.size ?? estimateSize(index));
				sizeCacheRef.current.set(key, measuredHeight);

				// Adjust scroll position if an item above the current scroll offset changed height
				if (item && Math.abs(delta) > 0.5) {
					const shouldAdjust = shouldAdjustScrollPositionOnItemSizeChange
						? shouldAdjustScrollPositionOnItemSizeChange(item, delta)
						: item.start < scrollOffsetRef.current - scrollMargin;

					if (shouldAdjust) {
						const el = getScrollElement();
						const nextOffset = Math.max(0, scrollOffsetRef.current + delta);
						scrollOffsetRef.current = nextOffset;
						setElementScrollOffset(el, nextOffset, "auto");
						setScrollOffset(nextOffset);
					}
				}

				setMeasurementVersion((v) => v + 1);
			}
		},
		[
			count,
			getItemKey,
			measurements,
			estimateSize,
			shouldAdjustScrollPositionOnItemSizeChange,
			scrollMargin,
			getScrollElement,
		],
	);

	const measureElement = useCallback(
		(node: Element | null) => {
			if (!node) return;
			measureNode(node);

			if (
				typeof ResizeObserver !== "undefined" &&
				!observedNodesRef.current.has(node)
			) {
				const ro = new ResizeObserver((entries) => {
					for (const entry of entries) {
						measureNode(entry.target);
					}
				});
				ro.observe(node);
				observedNodesRef.current.set(node, ro);
			}
		},
		[measureNode],
	);

	useEffect(() => {
		return () => {
			observedNodesRef.current.forEach((ro) => ro.disconnect());
			observedNodesRef.current.clear();
		};
	}, []);

	const getSnapshot = useCallback((): VirtualScrollSnapshot => {
		const adjustedOffset = Math.max(0, scrollOffsetRef.current - scrollMargin);
		let anchorKey: VirtualItemKey | null = null;
		let anchorIndex = 0;
		let anchorRelativeOffset = 0;

		if (measurements.length > 0) {
			anchorIndex = findNearestBinarySearch(
				0,
				measurements.length - 1,
				(idx) => measurements[idx].start,
				adjustedOffset,
			);
			const anchorItem = measurements[anchorIndex];
			if (anchorItem) {
				anchorKey = anchorItem.key;
				anchorRelativeOffset = adjustedOffset - anchorItem.start;
			}
		}

		const serializedMeasurements: Record<string, number> = {};
		sizeCacheRef.current.forEach((size, key) => {
			serializedMeasurements[String(key)] = size;
		});

		return {
			scrollOffset: scrollOffsetRef.current,
			anchorKey,
			anchorIndex,
			anchorRelativeOffset,
			measurements: serializedMeasurements,
			timestamp: Date.now(),
		};
	}, [measurements, scrollMargin]);

	const restoreSnapshot = useCallback(
		(snapshot: VirtualScrollSnapshot) => {
			if (snapshot.measurements) {
				Object.entries(snapshot.measurements).forEach(([k, v]) => {
					if (typeof v === "number" && v > 0) {
						sizeCacheRef.current.set(k, v);
					}
				});
			}
			const el = getScrollElement();
			let targetOffset = snapshot.scrollOffset;
			if (snapshot.anchorKey !== null) {
				const anchorItem = measurements.find(
					(m) => m.key === snapshot.anchorKey,
				);
				if (anchorItem) {
					targetOffset = anchorItem.start + snapshot.anchorRelativeOffset;
				}
			}
			scrollOffsetRef.current = targetOffset;
			setElementScrollOffset(el, targetOffset, "auto");
			setScrollOffset(targetOffset);
		},
		[getScrollElement, measurements],
	);

	// Persist snapshot automatically when snapshotKey is provided
	useEffect(() => {
		if (!snapshotKey || count === 0) return;
		const snap = getSnapshot();
		saveVirtualSnapshot(snapshotKey, snap);
	}, [snapshotKey, count, scrollOffset, getSnapshot]);

	const scrollToOffset = useCallback(
		(
			offset: number,
			 opts?: { align?: "start" | "center" | "end" | "auto"; behavior?: ScrollBehavior },
		) => {
			const el = getScrollElement();
			if (!el) return;
			const behavior = opts?.behavior ?? "auto";
			setElementScrollOffset(el, offset, behavior);
		},
		[getScrollElement],
	);

	const scrollToIndex = useCallback(
		(
			index: number,
			opts?: { align?: "start" | "center" | "end" | "auto"; behavior?: ScrollBehavior },
		) => {
			if (measurements.length === 0) return;
			const clampedIndex = Math.max(0, Math.min(measurements.length - 1, index));
			const item = measurements[clampedIndex];
			if (!item) return;

			const align = opts?.align ?? "auto";
			const behavior = opts?.behavior ?? "auto";
			const vpSize = viewportSize;
			const currentStart = scrollOffsetRef.current;
			const currentEnd = currentStart + vpSize;

			let targetOffset = item.start + scrollMargin;
			if (align === "center") {
				targetOffset = item.start + scrollMargin - vpSize / 2 + item.size / 2;
			} else if (align === "end") {
				targetOffset = item.end + scrollMargin - vpSize;
			} else if (align === "auto") {
				if (item.start + scrollMargin < currentStart) {
					targetOffset = item.start + scrollMargin;
				} else if (item.end + scrollMargin > currentEnd) {
					targetOffset = item.end + scrollMargin - vpSize;
				} else {
					return;
				}
			}

			scrollToOffset(targetOffset, { behavior });
		},
		[measurements, viewportSize, scrollMargin, scrollToOffset],
	);

	const instance = useMemo<VirtualizerInstance>(
		() => ({
			getVirtualItems: () => virtualItems,
			getTotalSize: () => totalSize,
			measureElement,
			scrollToOffset,
			scrollToIndex,
			getSnapshot,
			restoreSnapshot,
			scrollOffset,
			viewportSize,
			isScrolling,
			range,
		}),
		[
			virtualItems,
			totalSize,
			measureElement,
			scrollToOffset,
			scrollToIndex,
			getSnapshot,
			restoreSnapshot,
			scrollOffset,
			viewportSize,
			isScrolling,
			range,
		],
	);

	useEffect(() => {
		onChange?.(instance);
	}, [instance, onChange]);

	return instance;
}

/**
 * Window-scrolling virtualizer convenience hook.
 */
export function useWindowVirtualizer(
	options: Omit<VirtualizerOptions<Window>, "getScrollElement">,
): VirtualizerInstance {
	return useVirtualizer<Window>({
		...options,
		getScrollElement: () => (typeof window !== "undefined" ? window : null),
	});
}
