import { compileTemplate } from "../src/ng-template";
import { of } from "rxjs";
import { delay } from "rxjs/operators";

function htmlToElement(html: any) {
  let template = document.createElement('template');
  html = html.trim(); // Never return a text node of whitespace as the result
  template.innerHTML = html;
  return template.content.firstChild as HTMLElement;
}

async function compile(template: string, data?: any) {
  let result = htmlToElement(template);
  await compileTemplate(result, data);
  return result;
}

async function toText(template: string, data?: any) {
  return (await compile(template, data)).innerText.trim();
}

describe('Template compiler', () => {
  it('interpolation', async () => {
    let template = `<div>{{a}}: {{a+b}}</div>`;
    let text1 = await toText(template, { a: 2, b: 3 });
    expect(text1).toBe('2: 5');
    let template2 = `<div>{{type}}: <b>{{value}}</b></div>`;
    let elem2 = await compile(template2, { type: 'x', value: 'y' });
    expect(elem2.outerHTML).toBe(`<div>x: <b>y</b></div>`);
  });

  it('attribute', async () => {
    let template = `<div [role]="role"></div>`;
    let elem = await compile(template, { role: 'test' });
    expect(elem.outerHTML).toBe(`<div role="test"></div>`);
  });

  it('attribute interpolation', async () => {
    let template = `<img width="100%" [src]="'/test/path/' + image">`;
    let elem = await compile(template, { image: 'picture.jpg' });
    expect(elem.outerHTML).toBe(`<img width="100%" src="/test/path/picture.jpg">`);
  });

  it('style attribute', async () => {
    let template = `<div [style.max-width]="100px"></div>`;
    let elem = await compile(template);
    expect(elem.style.maxWidth).toBe(`100px`);
  });

  it('style attribute interpolation', async () => {
    let template = `<div [style.max-width.px]="100+500"></div>`;
    let elem = await compile(template);
    expect(elem.style.maxWidth).toBe(`600px`);
  });

  it('custom classes', async () => {
    let template = `<div [class.test]="ctest"></div>`;
    let elem = await compile(template, {ctest: false});
    expect(elem.outerHTML).toBe(`<div></div>`);

    let template2 = `<div [class.test]="ctest"></div>`;
    let elem2 = await compile(template2, {ctest: true});
    expect(elem2.outerHTML).toBe(`<div class="test"></div>`);

    let template3 = `<div class="pre" [class.test]="ctest"></div>`;
    let elem3 = await compile(template3, {ctest: true});
    expect(elem3.outerHTML).toBe(`<div class="pre test"></div>`);
  });

  it('*ngIf', async () => {
    let template = `<div>Hello, <span *ngIf="showName">Rem</span></div>`;
    let text1 = await toText(template, { showName: false });
    expect(text1).toBe('Hello,');
    let text2 = await toText(`<div>Hello, <span *ngIf="showName">Rem</span></div>`, { showName: true });
    expect(text2).toBe('Hello, Rem');
  });

  it('*ngIf as', async () => {
    let template = `<div><span *ngIf="users.find(u => u.name === 'Rem') as user">{{user.message}}</span></div>`;
    let users = [
      { name: 'Ivan', message: 'Version' },
      { name: 'Rem', message: 'App' }
    ];
    let text = await toText(template, { users });
    expect(text).toBe('App');
  });

  it('*ngIf as + container', async () => {
    let template =
      `<div><ng-container *ngIf="users.find(u => u.name === 'Rem') as user"><span>{{user.message}}</span></ng-container></div>`;
    let users = [
      { name: 'Ivan', message: 'Version' },
      { name: 'Rem', message: 'App' }
    ];
    let elem = await compile(template, { users });
    expect(elem.outerHTML).toBe(`<div><span>App</span></div>`);
  });

  it('*ngFor', async () => {
    let template = `<div><span *ngFor="let x of numbers">Rem-{{x + 1}}</span></div>`;
    let text1 = await toText(template, { numbers: [0, 1] });
    expect(text1).toBe('Rem-1Rem-2');
    let text2 = await toText(template, { numbers: [] });
    expect(text2).toBe('');
  });

  it('async', async () => {
    let template = `<div>{{name}}</div>`;
    let text1 = await toText(template, { name: of('Rem').pipe(delay(20)) });
    expect(text1).toBe('Rem');
  });

  it('container', async () => {
    let template = `<div><ng-container *ngIf="test"><span>a</span><span>b</span></ng-container></div>`;
    let elem1 = await compile(template, { test: false });
    expect(elem1.outerHTML).toBe(`<div></div>`);
    let elem2 = await compile(template, { test: true });
    expect(elem2.outerHTML).toBe(`<div><span>a</span><span>b</span></div>`);
  });

  it('template', async () => {
    let template = `<div>
      <ng-template #test>AbbA</ng-template>
      <ng-container *ngTemplateOutlet="test"></ng-container><ng-container *ngTemplateOutlet="test"></ng-container>
    </div>`;
    let text = await toText(template);
    expect(text).toBe(`AbbAAbbA`);

    let template1 = `<div>
      <ng-template #test><span *ngIf="show">AbbA</span></ng-template>
      <ng-container *ngTemplateOutlet="test"></ng-container><ng-container *ngTemplateOutlet="test"></ng-container>
    </div>`;
    let text1 = await toText(template1, {show: true});
    expect(text1).toBe(`AbbAAbbA`);
    text1 = await toText(template1, {show: false});
    expect(text1).toBe(``);
  });
});
