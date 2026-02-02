# enzyme-on-rtl

**Automated migration from Enzyme to React Testing Library.**

[![npm version](https://img.shields.io/npm/v/enzyme-on-rtl)](https://npmjs.com/package/enzyme-on-rtl)
[![License MIT](https://img.shields.io/npm/l/enzyme-on-rtl)](LICENSE)

---

## The Problem

**Enzyme is dead.** Airbnb stopped maintaining it in 2021, and there's no React 18/19 adapter. Thousands of projects are stuck on unmaintained testing code.

**Migrating manually** takes weeks for large codebases. The patterns are repetitive but tedious.

**enzyme-on-rtl** automates the conversion.

---

## The Solution

A command-line tool that converts Enzyme test patterns to React Testing Library equivalents:

```bash
npx enzyme-on-rtl convert MyComponent.test.tsx
```

### What It Converts

| Enzyme Pattern | React Testing Library |
|----------------|----------------------|
| `mount(<C />)` | `render(<C />)` |
| `shallow(<C />)` | `render(<C />)` |
| `wrapper.find('.btn')` | `screen.getByTestId('btn')` |
| `wrapper.text()` | `textContent` |
| `wrapper.html()` | `innerHTML` |
| `wrapper.simulate('click')` | `userEvent.click()` |
| `wrapper.find('.btn').exists()` | `expect(screen.queryByTestId('btn')).not.toBeInTheDocument()` |
| `import { mount } from 'enzyme'` | RTL imports + cleanup |

---

## Installation

```bash
# Global install (recommended for CLI use)
npm install -g enzyme-on-rtl

# Or use via npx
npx enzyme-on-rtl@latest convert ./src
```

---

## Usage

### Convert a single file

```bash
enzyme-on-rtl convert MyComponent.test.tsx
```

### Convert a directory

```bash
enzyme-on-rtl convert-dir ./src --output ./rtl-tests
```

### Preview changes (dry run)

```bash
enzyme-on-rtl diff MyComponent.test.tsx
```

### List all patterns

```bash
enzyme-on-rtl list
```

### Options

| Flag | Description |
|------|-------------|
| `-o, --output` | Output file or directory (default: overwrite) |
| `-h, --help` | Show help |
| `-v, --version` | Show version |

---

## Example

**Before (Enzyme):**

```typescript
import { mount } from 'enzyme'
import Button from './Button'

describe('Button', () => {
  it('calls onClick when clicked', () => {
    const onClick = jest.fn()
    const wrapper = mount(<Button onClick={onClick} />)
    
    wrapper.find('.submit-button').simulate('click')
    expect(onClick).toHaveBeenCalled()
    expect(wrapper.text()).toContain('Submitted')
  })
})
```

**After (React Testing Library):**

```typescript
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { cleanup } from '@testing-library/react'
import Button from './Button'

afterEach(() => cleanup())

describe('Button', () => {
  it('calls onClick when clicked', async () => {
    const onClick = jest.fn()
    render(<Button onClick={onClick} />)
    
    const button = screen.getByTestId('submit-button')
    await userEvent.click(button)
    expect(onClick).toHaveBeenCalled()
    expect(screen.getByText('Submitted')).toBeInTheDocument()
  })
})
```

---

## Patterns Supported

1. `mount()` → `render()`
2. `shallow()` → `render()`
3. `.find(selector)` → `screen.getByTestId()`, `getByRole()`, or `getByText()`
4. `.text()` → `textContent`
5. `.html()` → `innerHTML`
6. `.simulate('click')` → `userEvent.click()`
7. `.simulate('change')` → `fireEvent.change()`
8. `.setProps()` → Re-render comment
9. `.state()` → Custom state inspection comment
10. `.instance()` → Behavior testing comment
11. `.find().exists()` → `expect(queryByTestId()).not.toBeInTheDocument()`
12. Enzyme imports → RTL imports + cleanup

---

## Development

```bash
# Install dependencies
pnpm install

# Run tests
pnpm test

# Build for production
pnpm build

# Run CLI
pnpm cli convert ./test-fixture.tsx
```

---

## Why "enzyme-on-rtl"?

The name reflects the transition: **Enzyme ON React Testing Library**. Not just converting from Enzyme, but placing your tests ON a modern, supported testing foundation.

---

## License

MIT © Peter W.

---

## Contributing

Issues and PRs welcome! This tool is early-stage — bug reports and pattern suggestions help a lot.
