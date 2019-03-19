import { isObservable } from 'rxjs'

export type Evaluator = (code: string) => Promise<any>

interface Params {
  templates: Map<string, HTMLElement>
}

/**
 * return function to eval expression with variables defined in context
 * @param context
 */
export function createEvaluator(context: { [variable: string]: any }): Evaluator {
  let entries = []
  for (let property in context) {
    entries.push([property, context[property]])
  }
  let params = entries.map(e => e[0])
  let fun = new Function('code', ...params, `return eval(code)`)
  let args = entries.map(e => e[1])
  return async (code: string) => {
    let result = fun.call(undefined, code, ...args)
    if (isObservable(result)) {
      result = await result.toPromise()
    }
    return result
  }
}

// can change current context because directives can introduce new variables
// return new Evaluator or undefined if no element compilation is required
export async function applyAttributes(element: Element, context: any, evaluator: Evaluator) {
  let advClasses = ''
  for (let k = 0; k < element.attributes.length; ++k) {
    let attr = element.attributes[k]
    let attrName = attr.nodeName
    let value = attr.value
    let remove = true
    if (attrName === '*ngif') {
      let expression = value
      let variable: string | undefined = undefined
      let match = expression.match(/(.*)\s+as\s+(\w+)\s*$/)
      if (match) {
        expression = match[1]
        variable = match[2]
      }
      let expressionValue = await evaluator(expression)
      if (expressionValue) {
        if (variable) {
          context[variable] = expressionValue
          evaluator = createEvaluator(context)
        }
      } else {
        element.remove()
        return
      }
    } else if (attrName === '*ngfor') {
      let parser = /(let|var)\s*(\w*)\s*of\s*(.*)/.exec(value)
      if (parser && parser.length === 4) {
        let varName = parser[2]
        let arrExpression = parser[3]
        let array = await evaluator(arrExpression)
        let nextSibling = element.nextSibling
        element.removeAttribute(attrName)
        let elements = [element]
        if (array && array.length > 0) {
          for (let j = 1; j < array.length; ++j) {
            let forElement = element.cloneNode(true) as Element
            element.parentElement!.insertBefore(forElement, nextSibling)
            elements.push(forElement)
          }
          let promises = elements.map((e, index) =>
            compileTemplate(e, { ...context, [varName]: array[index] })
          )
          await Promise.all(promises)
        } else {
          element.remove()
        }
        return
      }
    } else if (attrName.startsWith('[') && attrName.endsWith(']')) {
      let newName = attrName.slice(1, -1)
      let parts = newName.split('.')
      if (parts.length === 2 && parts[0] === 'class') {
        let newValue = await evaluator(value)
        if (newValue) {
          advClasses += ' ' + parts[1]
        }
      } else if (parts.length === 2 && parts[0] === 'style') {
        if (element instanceof HTMLElement) {
          let s = parts[1]
          ;(element.style as any)[parts[1]] = value
        }
      } else if (parts.length === 3 && parts[0] === 'style') {
        if (element instanceof HTMLElement) {
          let newValue = await evaluator(value)
          ;(element.style as any)[parts[1]] = newValue + parts[2]
        }
      } else {
        let newValue = await evaluator(value)
        element.setAttribute(newName, newValue.toString())
      }
    } else {
      remove = false
    }
    if (remove) {
      element.removeAttribute(attrName)
      k--
    }
  }
  if (advClasses) {
    let classAttr = element.attributes.getNamedItem('class')
    if (classAttr) {
      classAttr.value += advClasses
    } else {
      element.setAttribute('class', advClasses.trim())
    }
  }
  return evaluator
}

/**
 * eval expression with variables defined in context
 * @param context
 */
export async function compileElement(element: Element, context: any, params: Params) {
  let evaluator: Evaluator | undefined = createEvaluator(context)

  if (element.nodeName === 'NG-CONTAINER') {
    let templateAttr = element.attributes.getNamedItem('*ngtemplateoutlet')
    if (templateAttr) {
      let templateNode = params.templates.get('#' + templateAttr.value)
      if (templateNode) {
        if (templateNode.children.length === 0) {
          let newElement = document.createElement('span')
          element.parentElement!.insertBefore(newElement, element)
          newElement.innerHTML = templateNode.innerHTML
          await compileElement(newElement, context, params)
        }
        for (let i = 0; i < templateNode.children.length; ++i) {
          let clone = templateNode.children[i].cloneNode(true) as Element
          element.parentElement!.insertBefore(clone, element)
          await compileElement(clone, context, params)
        }
      }
      element.remove()
    } else {
      evaluator = await applyAttributes(element, context, evaluator)
      if (evaluator) {
        for (let i = 0; i < element.children.length; ++i) {
          let clone = element.children[i].cloneNode(true) as Element
          element.parentElement!.insertBefore(clone, element)
          await compileElement(clone, context, params)
        }
        element.remove()
      }
    }
    return true
  }

  evaluator = await applyAttributes(element, context, evaluator)
  if (evaluator) {
    for (let i = element.children.length - 1; i >= 0; --i) {
      await compileElement(element.children.item(i)!, context, params)
    }

    for (let i = element.childNodes.length - 1; i >= 0; --i) {
      let node = element.childNodes[i]
      if (node.nodeType === Node.TEXT_NODE) {
        let exprReg = /{{\s*([^}]*)}}/
        while (true) {
          let match = node.textContent!.match(exprReg)
          if (match) {
            let replace = await evaluator(match[1])
            if (replace === undefined || replace === null) {
              replace = ''
            }
            node.textContent = node.textContent!.replace(exprReg, replace)
          } else {
            break
          }
        }
      }
    }
  }
  return true
}

/**
 * process all angular instruction in given Element or HTMLElement
 * return true if succeed
 * @param context
 */
export async function compileTemplate(element: Element, context?: { [variable: string]: any }) {
  let templates = element.querySelectorAll('ng-template')
  let templateMap = new Map<string, HTMLElement>()
  for (let i = 0; i < templates.length; ++i) {
    let attributes = templates[i].attributes
    for (let j = 0; j < attributes.length; ++j) {
      if (attributes[j].nodeName.startsWith('#')) {
        templateMap.set(attributes[j].nodeName, templates[i] as HTMLElement)
        break
      }
    }
  }
  let params: Params = {
    templates: templateMap
  }
  let result = await compileElement(element, context || {}, params)
  for (let i = 0; i < templates.length; ++i) {
    templates[i].remove()
  }
  return result
}

export function htmlToElement(html: string) {
  let template = document.createElement('template')
  html = html.trim() // Never return a text node of whitespace as the result
  template.innerHTML = html
  return template.content.firstChild as HTMLElement
}
