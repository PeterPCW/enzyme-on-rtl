/**
 * Enzyme to RTL Converter - Core Module
 * 
 * Converts Enzyme test patterns to React Testing Library equivalents.
 */

export interface ConversionResult {
  code: string
  warnings: string[]
  changes: ConversionChange[]
}

export interface ConversionChange {
  type: string
  original: string
  replacement: string
  line: number
}

/**
 * Pattern mappings from Enzyme to RTL
 * NOTE: Order matters! Combined patterns MUST come before simpler patterns.
 */
export const ENZYME_TO_RTL_PATTERNS = [
  // shallow() → render with cleanup
  {
    enzyme: /shallow\s*\(\s*<[^>]+[^/]*\s*\)/g,
    rtl: (match: string) => {
      return `render(${match.replace('shallow', '')})`
    },
    description: 'shallow() → render()'
  },
  // mount → render with cleanup (with proper closing >)
  {
    enzyme: /mount\s*\(\s*<([^>]+?)\s*\/?\s*>\s*\)/g,
    rtl: (...args: string[]) => {
      return `render(<${args[1]} />)`
    },
    description: 'mount() → render()'
  },
  // expect(wrapper.find('.selector').exists()).toBe() → expect(screen.queryByTestId('selector')).not.toBeInTheDocument()
  // MUST come before .find() pattern to avoid partial matching issues
  {
    enzyme: /expect\s*\(\s*(\w+)\s*\.\s*find\s*\(\s*['"]([.#a-zA-Z0-9_-]+)['"]\s*\)\s*\.\s*exists\s*\(\s*\)\s*\)\s*\.\s*toBe\s*\([^)]+\s*\)/g,
    rtl: (...args: string[]) => {
      const selector = args[2].replace(/^\./, '')
      return ` expect(screen.queryByTestId('${selector}')).not.toBeInTheDocument()`
    },
    description: '.find().exists().toBe() → queryByTestId (before .find())'
  },
  // wrapper.find() → screen.getByRole / getByText
  {
    enzyme: /\.find\s*\(\s*['"]([.#a-zA-Z0-9_-]+)['"]\s*\)/g,
    rtl: (...args: string[]) => {
      const selector = args[1]
      if (/^(button|input|select|textarea|form)$/i.test(selector)) {
        return ` screen.getByRole('${selector.toLowerCase()}')`
      }
      if (/^[a-zA-Z][a-zA-Z0-9]*$/.test(selector) && !selector.includes('.') && !selector.startsWith('#')) {
        return ` screen.getByText(/^${selector}$/)`
      }
      return ` screen.getByTestId('${selector}')`
    },
    description: '.find() → RTL queries'
  },
  // wrapper.text() → screen.getByText().textContent
  {
    enzyme: /\.text\s*\(\s*\)/g,
    rtl: () => `textContent`,
    description: '.text() → textContent'
  },
  // wrapper.html() → container.innerHTML
  {
    enzyme: /\.html\s*\(\s*\)/g,
    rtl: () => `innerHTML`,
    description: '.html() → innerHTML'
  },
  // wrapper.simulate() → fireEvent / userEvent
  {
    enzyme: /\.simulate\s*\(\s*['"]([^'"]+)['"](?:\s*,\s*([^)]+))?\s*\)/g,
    rtl: (...args: string[]) => {
      const event = args[1]
      const data = args[2]
      if (event === 'click') {
        return data ? `userEvent.click(screen.getByRole('button'), ${data})` : `userEvent.click(screen.getByRole('button'))`
      }
      return `fireEvent.${event}(screen.getByRole('button')${data ? ', ' + data : ''})`
    },
    description: '.simulate() → fireEvent/userEvent'
  },
  // wrapper.setProps() → rerender
  {
    enzyme: /\.setProps\s*\(\s*(\{[^}]+})\s*\)/g,
    rtl: (...args: string[]) => {
      const props = args[1]
      return `// Note: RTL doesn't have setProps. Re-render component with new props.\n// ${props}`
    },
    description: '.setProps() → re-render pattern'
  },
  // wrapper.state() → useState (not directly mappable)
  {
    enzyme: /\.state\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    rtl: () => {
      return `// state() is not directly mappable in RTL.\n// Consider using a custom render with state inspection.`
    },
    description: '.state() → custom state inspection'
  },
  // wrapper.instance() → not mappable
  {
    enzyme: /\.instance\s*\(\s*\)/g,
    rtl: () => {
      return `// instance() is not available in RTL.\n// Consider testing through user-facing behavior.`
    },
    description: '.instance() → behavior testing'
  },
  // expect(wrapper.text()).toBe() → expect(screen.getByText()).toHaveTextContent()
  {
    enzyme: /expect\s*\(\s*([^.]+)\s*\.\s*text\s*\(\s*\)\s*\)\s*\.\s*toBe\s*\(\s*([^)]+)\s*\)/g,
    rtl: (...args: string[]) => {
      const expected = args[2]
      return `expect(screen.getByText(${expected})).toHaveTextContent(${expected})`
    },
    description: '.text().toBe() → getByText + toHaveTextContent'
  },
]

/**
 * Known Enzyme imports to convert
 */
export const ENZYME_IMPORTS = [
  { enzyme: "import { shallow } from 'enzyme'", rtl: '// RTL: import { render, screen, fireEvent, userEvent } from "@testing-library/react"' },
  { enzyme: "import { mount } from 'enzyme'", rtl: '// RTL: import { render, screen, fireEvent, userEvent } from "@testing-library/react"' },
  { enzyme: "import { configure } from 'enzyme'", rtl: '// RTL: import { render } from "@testing-library/react"' },
  { enzyme: "import Adapter from '@wojtekmaj/enzyme-adapter-react-17'", rtl: '// RTL: No adapter needed - @testing-library/react handles React 18+' },
  { enzyme: "import Adapter from 'enzyme-adapter-react-16'", rtl: '// RTL: No adapter needed - @testing-library/react handles React 18+' },
]

/**
 * Main converter class
 */
export class EnzymeToRTLConverter {
  private patterns: typeof ENZYME_TO_RTL_PATTERNS
  private imports = ENZYME_IMPORTS
  
  constructor() {
    this.patterns = ENZYME_TO_RTL_PATTERNS.map(p => ({
      enzyme: new RegExp(p.enzyme.source, p.enzyme.flags),
      rtl: p.rtl,
      description: p.description
    }))
  }
  
  /**
   * Convert Enzyme code to RTL
   */
  convert(code: string): ConversionResult {
    const warnings: string[] = []
    const changes: ConversionChange[] = []
    let result = code
    
    // Track what Enzyme imports are found
    let hasShallowOrMount = false
    let hasConfigure = false
    
    // Convert imports first
    for (const imp of this.imports) {
      const regex = new RegExp(imp.enzyme.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')
      if (regex.test(result)) {
        changes.push({
          type: 'import',
          original: imp.enzyme,
          replacement: imp.rtl,
          line: this.findLineNumber(result, imp.enzyme)
        })
        result = result.replace(regex, imp.rtl)
        warnings.push(`Converted import: ${imp.enzyme}`)
        
        // Track which type of import
        if (imp.enzyme.includes('shallow') || imp.enzyme.includes('mount')) {
          hasShallowOrMount = true
        }
        if (imp.enzyme.includes('configure')) {
          hasConfigure = true
        }
      }
    }
    
    // Add RTL imports at the top if Enzyme imports were converted
    if (changes.length > 0) {
      // Choose appropriate import set based on what was found
      let rtlImport: string
      if (hasShallowOrMount) {
        rtlImport = `import { render, screen, fireEvent, userEvent } from '@testing-library/react'
import { cleanup } from '@testing-library/react'

// Auto-generated by enzyme-on-rtl
// Run cleanup after each test:
afterEach(() => cleanup())`
      } else if (hasConfigure) {
        rtlImport = `import { render } from '@testing-library/react'

// Auto-generated by enzyme-on-rtl`
      } else {
        rtlImport = `import { render } from '@testing-library/react'

// Auto-generated by enzyme-on-rtl`
      }
      
      if (!result.includes('Auto-generated by enzyme-on-rtl')) {
        result = rtlImport + '\n\n' + result
      }
    }
    
    // Apply pattern conversions in order
    for (const pattern of this.patterns) {
      try {
        // Find all matches first
        const regex = new RegExp(pattern.enzyme.source, 'g')
        const allMatches = [...result.matchAll(regex)]
        
        // Process matches in reverse order to avoid index issues
        for (const match of allMatches.reverse()) {
          const captureGroups: string[] = match.slice(1).filter((g): g is string => g !== undefined)
          
          let replacement: string
          // Call rtl with match[0] plus capture groups
          const args = [match[0], ...captureGroups]
          replacement = (pattern.rtl as (...args: string[]) => string)(...args)
          
          if (replacement !== match[0]) {
            changes.push({
              type: 'conversion',
              original: match[0],
              replacement: replacement,
              line: this.findLineNumber(result, match[0])
            })
            result = result.replace(match[0], replacement)
            warnings.push(`Applied pattern: ${pattern.description}`)
          }
        }
      } catch (e) {
        console.warn(`Skipping pattern: ${pattern.description} - ${e}`)
      }
    }
    
    return { code: result, warnings, changes }
  }
  
  private findLineNumber(code: string, search: string): number {
    const lines = code.split('\n')
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes(search)) {
        return i + 1
      }
    }
    return 1
  }
  
  addPattern(pattern: typeof ENZYME_TO_RTL_PATTERNS[0]): EnzymeToRTLConverter {
    this.patterns.push(pattern)
    return this
  }
  
  resetPatterns(): EnzymeToRTLConverter {
    // Deep clone to avoid sharing patterns between instances
    this.patterns = ENZYME_TO_RTL_PATTERNS.map(p => ({
      enzyme: new RegExp(p.enzyme.source, p.enzyme.flags),
      rtl: p.rtl,
      description: p.description
    }))
    return this
  }
}

export function createConverter(): EnzymeToRTLConverter {
  return new EnzymeToRTLConverter()
}
