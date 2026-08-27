/**
 * TOC (Table of Contents) 工具类
 * 用于 SidebarTOC 和 FloatingTOC 的共享逻辑
 */

import I18nKey from "@/i18n/i18nKey";
import { i18n } from "@/i18n/translation";
import {
	computeTocItems,
	renderTocItemHTML,
	type TocInput,
} from "@/utils/toc-shared";

export interface TOCConfig {
	contentId: string;
	indicatorId: string;
	maxLevel?: number;
	scrollOffset?: number;
}

export class TOCManager {
	private tocItems: HTMLElement[] = [];
	private observer: IntersectionObserver | null = null;
	private maxLevel: number;
	private scrollTimeout: number | null = null;
	private scrollListener: (() => void) | null = null;
	private scrollAnimationFrame: number | null = null;
	private contentId: string;
	private indicatorId: string;
	private scrollOffset: number;

	constructor(config: TOCConfig) {
		this.contentId = config.contentId;
		this.indicatorId = config.indicatorId;
		this.maxLevel = config.maxLevel || 3;
		this.scrollOffset = config.scrollOffset || 80;
	}

	/**
	 * 查找文章内容容器
	 */
	private getContentContainer(): Element | null {
		return (
			document.querySelector(".custom-md") ||
			document.querySelector(".prose") ||
			document.querySelector(".markdown-content")
		);
	}

	/**
	 * 查找所有标题
	 */
	private getAllHeadings(): HTMLElement[] {
		const contentContainer = this.getContentContainer();
		if (!contentContainer) {
			return [];
		}

		const headings = Array.from(
			contentContainer.querySelectorAll("h2, h3, h4, h5, h6"),
		) as HTMLElement[];
		const hasBilingualContent = contentContainer.querySelector(
			".language-content--en, .language-content--zh",
		);

		if (!hasBilingualContent) return headings;

		const activeLanguageClass =
			document.documentElement.dataset.siteLang === "zh-CN"
				? "language-content--zh"
				: "language-content--en";

		return headings.filter((heading) => {
			const languageContainer = heading.closest(
				".language-content--en, .language-content--zh",
			);
			return (
				!languageContainer ||
				languageContainer.classList.contains(activeLanguageClass)
			);
		});
	}

	/**
	 * 获取标题的纯文本内容（排除脚本、样式和自动锚点符号）
	 */
	private getCleanTextContent(element: HTMLElement): string {
		const clone = element.cloneNode(true) as HTMLElement;
		for (const el of clone.querySelectorAll("script, style, .anchor")) {
			el.remove();
		}
		return clone.textContent || "";
	}

	/**
	 * 空状态文案
	 */
	private getEmptyStateHTML(): string {
		return `<div class="text-center py-8 text-gray-500 dark:text-gray-400"><p>${i18n(I18nKey.tocEmpty)}</p></div>`;
	}

	/**
	 * 将 DOM 标题转换为与服务端一致的 TocInput
	 */
	private domHeadingsToInputs(headings: HTMLElement[]): TocInput[] {
		return headings.map((heading) => {
			const depth = Number.parseInt(heading.tagName.charAt(1), 10);
			let text = this.getCleanTextContent(heading)
				.replace(/#+\s*$/, "")
				.trim();

			// 空文本回退（例如动态副标题）
			if (!text) {
				const dataSubtitles = heading.getAttribute("data-subtitles");
				if (dataSubtitles) {
					try {
						const subtitles = JSON.parse(dataSubtitles);
						text = Array.isArray(subtitles) ? subtitles[0] : subtitles;
					} catch {
						// ignore
					}
				}
			}

			return { depth, slug: heading.id, text };
		});
	}

	/**
	 * 生成TOC HTML（客户端 fallback 路径，与服务端 SSR 输出保持一致）
	 */
	public generateTOCHTML(): string {
		const headings = this.getAllHeadings();

		if (headings.length === 0) {
			return this.getEmptyStateHTML();
		}

		const items = computeTocItems(this.domHeadingsToInputs(headings), {
			maxLevel: this.maxLevel,
		});

		if (items.length === 0) {
			return this.getEmptyStateHTML();
		}

		let tocHTML = "";
		for (const item of items) {
			tocHTML += renderTocItemHTML(item);
		}

		tocHTML += `<div id="${this.indicatorId}" style="opacity: 0;" class="toc-active-indicator"></div>`;

		return tocHTML;
	}

	/**
	 * 更新TOC内容（重建，DOM 遍历路径）
	 */
	public updateTOCContent(): void {
		const tocContent = document.getElementById(this.contentId);
		if (!tocContent) return;

		tocContent.innerHTML = this.generateTOCHTML();
		this.tocItems = Array.from(
			document.querySelectorAll(`#${this.contentId} a`),
		);
	}

	/**
	 * 获取可见的标题ID
	 */
	private getVisibleHeadingIds(): string[] {
		const headings = this.getAllHeadings();
		if (headings.length === 0) return [];

		const activationLine = this.scrollOffset + 12;
		let activeHeading = headings.find((heading) => Boolean(heading.id)) ?? null;

		for (const heading of headings) {
			if (!heading.id) continue;
			if (heading.getBoundingClientRect().top <= activationLine) {
				activeHeading = heading;
				continue;
			}
			break;
		}

		return activeHeading?.id ? [activeHeading.id] : [];
	}

	/**
	 * 更新活动状态
	 */
	public updateActiveState(): void {
		if (!this.tocItems || this.tocItems.length === 0) return;

		// 移除所有活动状态
		this.tocItems.forEach((item) => {
			item.classList.remove("visible");
		});

		const visibleHeadingIds = this.getVisibleHeadingIds();

		// 找到对应的TOC项并添加活动状态
		const activeItems = this.tocItems.filter((item) => {
			const headingId = item.dataset.headingId;
			return headingId && visibleHeadingIds.includes(headingId);
		});

		// 添加活动状态
		activeItems.forEach((item) => {
			item.classList.add("visible");
		});

		// 更新活动指示器
		this.updateActiveIndicator(activeItems);
	}

	/**
	 * 更新活动指示器
	 */
	private updateActiveIndicator(activeItems: HTMLElement[]): void {
		const indicator = document.getElementById(this.indicatorId);
		if (!indicator || !this.tocItems.length) return;

		if (activeItems.length === 0) {
			indicator.style.opacity = "0";
			return;
		}

		const tocContent = document.getElementById(this.contentId);
		if (!tocContent) return;

		const contentRect = tocContent.getBoundingClientRect();
		const firstActive = activeItems[0];
		const lastActive = activeItems[activeItems.length - 1];

		const firstRect = firstActive.getBoundingClientRect();
		const lastRect = lastActive.getBoundingClientRect();

		const top = firstRect.top - contentRect.top;
		const height = lastRect.bottom - firstRect.top;

		indicator.style.top = `${top}px`;
		indicator.style.height = `${height}px`;
		indicator.style.opacity = "1";

		// 自动滚动到活动项
		if (firstActive) {
			this.scrollToActiveItem(firstActive);
		}
	}

	/**
	 * 滚动到活动项
	 */
	private scrollToActiveItem(activeItem: HTMLElement): void {
		if (!activeItem) return;

		const tocContainer = document
			.querySelector(`#${this.contentId}`)
			?.closest(".toc-scroll-container");
		if (!tocContainer) return;

		// 清除之前的定时器
		if (this.scrollTimeout) {
			clearTimeout(this.scrollTimeout);
		}

		// 使用节流机制
		this.scrollTimeout = window.setTimeout(() => {
			const containerRect = tocContainer.getBoundingClientRect();
			const itemRect = activeItem.getBoundingClientRect();

			// 只在元素不在可视区域时才滚动
			const isVisible =
				itemRect.top >= containerRect.top &&
				itemRect.bottom <= containerRect.bottom;

			if (!isVisible) {
				const itemOffsetTop = (activeItem as HTMLElement).offsetTop;
				const containerHeight = tocContainer.clientHeight;
				const itemHeight = activeItem.clientHeight;

				// 计算目标滚动位置，将元素居中显示
				const targetScroll =
					itemOffsetTop - containerHeight / 2 + itemHeight / 2;

				tocContainer.scrollTo({
					top: targetScroll,
					behavior: "smooth",
				});
			}
		}, 100);
	}

	/**
	 * 处理点击事件
	 */
	public handleClick(event: Event): void {
		event.preventDefault();
		const target = event.currentTarget as HTMLAnchorElement;
		const id = decodeURIComponent(
			target.getAttribute("href")?.substring(1) || "",
		);
		const targetElement = document.getElementById(id);

		if (targetElement) {
			const targetTop =
				targetElement.getBoundingClientRect().top +
				window.pageYOffset -
				this.scrollOffset;
			const prefersReducedMotion = window.matchMedia(
				"(prefers-reduced-motion: reduce)",
			).matches;

			window.scrollTo({
				top: targetTop,
				behavior: prefersReducedMotion ? "auto" : "smooth",
			});

			history.replaceState(null, "", `#${encodeURIComponent(id)}`);
			window.setTimeout(
				() => this.updateActiveState(),
				prefersReducedMotion ? 0 : 650,
			);
		}
	}

	/**
	 * 设置IntersectionObserver
	 */
	public setupObserver(): void {
		const headings = this.getAllHeadings();

		if (this.observer) {
			this.observer.disconnect();
		}

		this.observer = new IntersectionObserver(
			() => {
				this.updateActiveState();
			},
			{
				rootMargin: `-${this.scrollOffset}px 0px -70% 0px`,
				threshold: 0,
			},
		);

		headings.forEach((heading) => {
			if (heading.id) {
				this.observer?.observe(heading);
			}
		});

		if (this.scrollListener) {
			window.removeEventListener("scroll", this.scrollListener);
		}
		if (this.scrollAnimationFrame !== null) {
			window.cancelAnimationFrame(this.scrollAnimationFrame);
			this.scrollAnimationFrame = null;
		}

		this.scrollListener = () => {
			if (this.scrollAnimationFrame !== null) return;
			this.scrollAnimationFrame = window.requestAnimationFrame(() => {
				this.scrollAnimationFrame = null;
				this.updateActiveState();
			});
		};
		window.addEventListener("scroll", this.scrollListener, { passive: true });
	}

	/**
	 * 绑定点击事件
	 */
	public bindClickEvents(): void {
		this.tocItems.forEach((item) => {
			item.addEventListener("click", this.handleClick.bind(this));
		});
	}

	/**
	 * 清理
	 */
	public cleanup(): void {
		if (this.observer) {
			this.observer.disconnect();
			this.observer = null;
		}
		if (this.scrollTimeout) {
			clearTimeout(this.scrollTimeout);
			this.scrollTimeout = null;
		}
		if (this.scrollListener) {
			window.removeEventListener("scroll", this.scrollListener);
			this.scrollListener = null;
		}
		if (this.scrollAnimationFrame !== null) {
			window.cancelAnimationFrame(this.scrollAnimationFrame);
			this.scrollAnimationFrame = null;
		}
	}

	/**
	 * 重建目录（DOM 遍历生成列表）+ 绑定交互。
	 * 用于 fallback：加密文章解密后、空 SSR、或站内导航后侧栏 DOM 变旧时。
	 */
	public render(): void {
		this.updateTOCContent();
		this.bindClickEvents();
		this.setupObserver();
		this.updateActiveState();
	}

	/**
	 * 判断现有锚点是否与当前正文的目录完全一致（避免站内导航后侧栏 DOM 未被
	 * swup 替换、仍显示上一篇目录的情况）。用与 SSR 相同的算法从当前正文算出
	 * 期望 id 序列并逐一比对——不同文章即使共用个别标题名也不会误判。
	 */
	private anchorsMatchCurrentContent(anchors: HTMLElement[]): boolean {
		const expected = computeTocItems(
			this.domHeadingsToInputs(this.getAllHeadings()),
			{ maxLevel: this.maxLevel },
		);
		if (expected.length !== anchors.length) return false;
		return expected.every(
			(item, i) => anchors[i].dataset.headingId === item.headingId,
		);
	}

	/**
	 * 附着到已有的服务端渲染锚点上（不重新生成列表），只绑定滚动高亮/点击。
	 * 若没有 SSR 锚点、或锚点属于上一篇文章（侧栏未被 swup 替换），回退到 render()。
	 */
	public attach(): void {
		const tocContent = document.getElementById(this.contentId);
		if (!tocContent) return;

		const anchors = Array.from(tocContent.querySelectorAll<HTMLElement>("a"));

		// 没有锚点（加密未解密/空）或锚点是上一篇的 → 重建
		if (anchors.length === 0 || !this.anchorsMatchCurrentContent(anchors)) {
			this.render();
			return;
		}

		this.tocItems = anchors;
		this.bindClickEvents();
		this.setupObserver();
		this.updateActiveState();
	}

	/**
	 * 初始化（向后兼容别名，等价于 render()）
	 */
	public init(): void {
		this.render();
	}
}

/**
 * 检查是否为文章页面
 */
export function isPostPage(): boolean {
	return window.location.pathname.includes("/posts/");
}
