import * as React from "react"

/**
 * Measures an element's rendered box, returning null until the first
 * measurement lands. Measurement runs in useLayoutEffect so size-dependent
 * output can be rendered before the first paint.
 */
export function useSize(ref) {
    const [size, setSize] = React.useState(null)

    React.useLayoutEffect(() => {
        const element = ref.current
        if (!element) return

        const measure = () => {
            const { width, height } = element.getBoundingClientRect()
            // Preserve identity when nothing changed so consumers don't re-render
            // on every ResizeObserver notification.
            setSize((prev) =>
                prev && prev.width === width && prev.height === height ? prev : { width, height }
            )
        }

        measure()

        const observer = new ResizeObserver(measure)
        observer.observe(element)
        return () => observer.disconnect()
    }, [ref])

    return size
}
