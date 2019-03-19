# Angular Template Compiler

Compile your Angular 2.x - Angular 8.x templates for print, emails, etc

### Usage

```
let data = { name: 'Roman' };
let result = htmlToElement(`<div>{{name}}</div>`, data);
await compileTemplate(result, data);
```


### Features

1. string interpolation
1. ng-template
1. ng-container
1. *ngIf + *ngIf as
1. *ngFor
1. [style.xxx]="value"
1. [style.xxx.px]="value"
1. [class.xxx]="value"
