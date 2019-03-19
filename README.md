# Angular Template Compiler [![Build Status](https://travis-ci.org/quanterion/ng-template.svg?branch=master)](https://travis-ci.org/quanterion/ng-template) [![npm version](https://badge.fury.io/js/%40quanterion%2Fng-template.svg)](https://badge.fury.io/js/%40quanterion%2Fng-template)

Compile your Angular 2.x - Angular 8.x templates for print, emails, etc

### Usage

```
let data = { name: 'Roman' };
let element = htmlToElement(`<div>{{name}}</div>`);
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
