import { describe, it, expect, beforeEach } from 'vitest'
import { EnzymeToRTLConverter, createConverter, ENZYME_TO_RTL_PATTERNS, ENZYME_IMPORTS } from '../src'

describe('EnzymeToRTLConverter', () => {
  let converter: EnzymeToRTLConverter

  beforeEach(() => {
    converter = createConverter()
  })

  describe('import conversions', () => {
    it('converts shallow import', () => {
      const code = `import { shallow } from 'enzyme'`
      const result = converter.convert(code)
      
      expect(result.code).toContain("@testing-library/react")
      expect(result.changes.length).toBeGreaterThan(0)
    })

    it('converts mount import', () => {
      const code = `import { mount } from 'enzyme'`
      const result = converter.convert(code)
      
      expect(result.code).toContain("@testing-library/react")
      expect(result.warnings.some(w => w.includes('import'))).toBe(true)
    })

    it('converts configure import', () => {
      const code = `import { configure } from 'enzyme'`
      const result = converter.convert(code)
      
      expect(result.code).toContain("import { render } from '@testing-library/react'")
    })
  })

  describe('shallow conversion', () => {
    it('converts shallow().find() to getByTestId', () => {
      const code = `
import { shallow } from 'enzyme'
import MyComponent from './MyComponent'

const wrapper = shallow(<MyComponent />)
expect(wrapper.find('.button').exists()).toBe(true)
`
      const result = converter.convert(code)
      
      expect(result.code).toContain('queryByTestId')
      expect(result.warnings.length).toBeGreaterThan(0)
    })

    it('converts shallow() mount pattern', () => {
      const code = `const wrapper = shallow(<MyComponent />)`
      const result = converter.convert(code)
      
      expect(result.code).toContain('render')
    })
  })

  describe('mount conversion', () => {
    it('converts mount() to render()', () => {
      const code = `const wrapper = mount(<MyComponent />)`
      const result = converter.convert(code)
      
      expect(result.code).toContain('render')
    })
  })

  describe('find conversion', () => {
    it('converts .find() to getByTestId', () => {
      const code = `wrapper.find('button')`
      const result = converter.convert(code)
      
      expect(result.code).toContain('getByRole')
    })

    it('converts .find() with class selector', () => {
      const code = `wrapper.find('.submit-button')`
      const result = converter.convert(code)
      
      expect(result.code).toContain('getByTestId')
    })
  })

  describe('text conversion', () => {
    it('converts .text() to textContent', () => {
      const code = `wrapper.text()`
      const result = converter.convert(code)
      
      expect(result.code).toContain('textContent')
    })
  })

  describe('html conversion', () => {
    it('converts .html() to innerHTML', () => {
      const code = `wrapper.html()`
      const result = converter.convert(code)
      
      expect(result.code).toContain('innerHTML')
    })
  })

  describe('simulate conversion', () => {
    it('converts .simulate("click") to userEvent.click', () => {
      const code = `wrapper.find('button').simulate('click')`
      const result = converter.convert(code)
      
      expect(result.code).toContain('userEvent.click')
    })

    it('converts .simulate("change") to fireEvent.change', () => {
      const code = `wrapper.find('input').simulate('change', { target: { value: 'test' } })`
      const result = converter.convert(code)
      
      expect(result.code).toContain('fireEvent')
    })
  })

  describe('setProps conversion', () => {
    it('converts .setProps() to re-render pattern', () => {
      const code = `wrapper.setProps({ newValue: 'test' })`
      const result = converter.convert(code)
      
      expect(result.code).toContain('Re-render')
      expect(result.code).toContain('setProps')
    })
  })

  describe('exists conversion', () => {
    it('converts .exists() to queryByTestId', () => {
      const code = `expect(wrapper.find('.button').exists()).toBe(true)`
      const result = converter.convert(code)
      
      expect(result.code).toContain('queryByTestId')
      expect(result.code).toContain('toBeInTheDocument')
    })
  })

  describe('state conversion', () => {
    it('converts .state() to comment about RTL limitations', () => {
      const code = `wrapper.state('count')`
      const result = converter.convert(code)
      
      expect(result.code).toContain('state()')
      expect(result.code).toContain('not directly mappable')
    })
  })

  describe('instance conversion', () => {
    it('converts .instance() to comment about RTL limitations', () => {
      const code = `wrapper.instance().handleClick()`
      const result = converter.convert(code)
      
      expect(result.code).toContain('instance()')
      expect(result.code).toContain('not available')
    })
  })

  describe('cleanup addition', () => {
    it('adds cleanup afterEach when Enzyme imports found', () => {
      const code = `
import { shallow } from 'enzyme'
import MyComponent from './MyComponent'

const wrapper = shallow(<MyComponent />)
`
      const result = converter.convert(code)
      
      expect(result.code).toContain('afterEach')
      expect(result.code).toContain('cleanup()')
    })
  })

  describe('createConverter()', () => {
    it('creates independent instances', () => {
      const conv1 = createConverter()
      const conv2 = createConverter()

      conv1.addPattern({
        enzyme: /custom/g,
        rtl: () => 'custom-rtl',
        description: 'Custom pattern'
      })

      const result1 = conv1.convert('custom test')
      const result2 = conv2.convert('custom test')

      // conv1 should have the custom pattern
      expect(result1.code).toContain('custom-rtl')
      // conv2 should not have the custom pattern
      expect(result2.code).not.toContain('custom-rtl')
    })
  })

  describe('resetPatterns()', () => {
    it('resets patterns to default', () => {
      converter.addPattern({
        enzyme: /custom/g,
        rtl: () => 'custom-rtl',
        description: 'Custom pattern'
      })

      converter.resetPatterns()

      const code = 'custom test'
      const result = converter.convert(code)
      expect(result.code).not.toContain('custom-rtl')
    })
  })

  describe('complex example', () => {
    it('converts a full Enzyme test to RTL', () => {
      const code = `
import React from 'react'
import { shallow } from 'enzyme'
import MyComponent from './MyComponent'

describe('MyComponent', () => {
  it('renders a button', () => {
    const wrapper = shallow(<MyComponent />)
    expect(wrapper.find('.submit-button').exists()).toBe(true)
    expect(wrapper.text()).toBe('Click me')
  })

  it('handles click', () => {
    const onClick = jest.fn()
    const wrapper = shallow(<MyComponent onClick={onClick} />)
    wrapper.find('button').simulate('click')
    expect(onClick).toHaveBeenCalled()
  })
})
`
      const result = converter.convert(code)

      // Should have RTL imports
      expect(result.code).toContain("@testing-library/react")
      
      // Should have cleanup
      expect(result.code).toContain('cleanup')
      
      // Should have conversion changes
      expect(result.changes.length).toBeGreaterThan(0)
      
      // Should have warnings
      expect(result.warnings.length).toBeGreaterThan(0)
    })
  })
})

describe('ENZYME_TO_RTL_PATTERNS', () => {
  it('has all expected patterns', () => {
    expect(ENZYME_TO_RTL_PATTERNS.length).toBeGreaterThan(0)
  })
})

describe('ENZYME_IMPORTS', () => {
  it('has all expected import conversions', () => {
    expect(ENZYME_IMPORTS.length).toBeGreaterThan(0)
    expect(ENZYME_IMPORTS.some(i => i.enzyme.includes('shallow'))).toBe(true)
    expect(ENZYME_IMPORTS.some(i => i.enzyme.includes('mount'))).toBe(true)
    expect(ENZYME_IMPORTS.some(i => i.enzyme.includes('configure'))).toBe(true)
  })
})
