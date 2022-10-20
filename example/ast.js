[
  {
    type: 1,
    ns: 0,
    tag: 'h1',
    tagType: 0,
    props: [
      {
        type: 6,
        name: 'ref',
        value: {
          type: 2,
          content: 'h1',
          loc: {
            start: {
              column: 13,
              line: 2,
              offset: 13,
            },
            end: {
              column: 17,
              line: 2,
              offset: 17,
            },
            source: '"h1"',
          },
        },
        loc: {
          start: {
            column: 9,
            line: 2,
            offset: 9,
          },
          end: {
            column: 17,
            line: 2,
            offset: 17,
          },
          source: 'ref="h1"',
        },
      },
      {
        type: 7,
        name: 'on',
        exp: {
          type: 4,
          content: 'changeComponent()',
          isStatic: false,
          constType: 0,
          loc: {
            start: {
              column: 26,
              line: 2,
              offset: 26,
            },
            end: {
              column: 43,
              line: 2,
              offset: 43,
            },
            source: 'changeComponent()',
          },
        },
        arg: {
          type: 4,
          content: 'click',
          isStatic: true,
          constType: 3,
          loc: {
            start: {
              column: 19,
              line: 2,
              offset: 19,
            },
            end: {
              column: 24,
              line: 2,
              offset: 24,
            },
            source: 'click',
          },
        },
        modifiers: [],
        loc: {
          start: {
            column: 18,
            line: 2,
            offset: 18,
          },
          end: {
            column: 44,
            line: 2,
            offset: 44,
          },
          source: '@click="changeComponent()"',
        },
      },
    ],
    isSelfClosing: false,
    children: [
      {
        type: 2,
        content: '父组件：App.component',
        loc: {
          start: {
            column: 45,
            line: 2,
            offset: 45,
          },
          end: {
            column: 62,
            line: 2,
            offset: 62,
          },
          source: '父组件：App.component',
        },
      },
    ],
    loc: {
      start: {
        column: 5,
        line: 2,
        offset: 5,
      },
      end: {
        column: 67,
        line: 2,
        offset: 67,
      },
      source:
        '<h1 ref="h1" @click="changeComponent()">父组件：App.component</h1>',
    },
  },
  {
    type: 1,
    ns: 0,
    tag: 'button-counter',
    tagType: 1,
    props: [
      {
        type: 6,
        name: 'class',
        value: {
          type: 2,
          content: 'fade-enter-activ',
          loc: {
            start: {
              column: 27,
              line: 3,
              offset: 94,
            },
            end: {
              column: 45,
              line: 3,
              offset: 112,
            },
            source: '"fade-enter-activ"',
          },
        },
        loc: {
          start: {
            column: 21,
            line: 3,
            offset: 88,
          },
          end: {
            column: 45,
            line: 3,
            offset: 112,
          },
          source: 'class="fade-enter-activ"',
        },
      },
      {
        type: 7,
        name: 'bind',
        exp: {
          type: 4,
          content: "{border:'1px solid yellow',color:textColor}",
          isStatic: false,
          constType: 0,
          loc: {
            start: {
              column: 54,
              line: 3,
              offset: 121,
            },
            end: {
              column: 97,
              line: 3,
              offset: 164,
            },
            source: "{border:'1px solid yellow',color:textColor}",
          },
        },
        arg: {
          type: 4,
          content: 'style',
          isStatic: true,
          constType: 3,
          loc: {
            start: {
              column: 47,
              line: 3,
              offset: 114,
            },
            end: {
              column: 52,
              line: 3,
              offset: 119,
            },
            source: 'style',
          },
        },
        modifiers: [],
        loc: {
          start: {
            column: 46,
            line: 3,
            offset: 113,
          },
          end: {
            column: 98,
            line: 3,
            offset: 165,
          },
          source: ':style="{border:\'1px solid yellow\',color:textColor}"',
        },
      },
      {
        type: 7,
        name: 'bind',
        exp: {
          type: 4,
          content: 'components',
          isStatic: false,
          constType: 0,
          loc: {
            start: {
              column: 107,
              line: 3,
              offset: 174,
            },
            end: {
              column: 117,
              line: 3,
              offset: 184,
            },
            source: 'components',
          },
        },
        arg: {
          type: 4,
          content: 'title',
          isStatic: true,
          constType: 3,
          loc: {
            start: {
              column: 100,
              line: 3,
              offset: 167,
            },
            end: {
              column: 105,
              line: 3,
              offset: 172,
            },
            source: 'title',
          },
        },
        modifiers: [],
        loc: {
          start: {
            column: 99,
            line: 3,
            offset: 166,
          },
          end: {
            column: 118,
            line: 3,
            offset: 185,
          },
          source: ':title="components"',
        },
      },
      {
        type: 7,
        name: 'on',
        exp: {
          type: 4,
          content: 'changeComponent',
          isStatic: false,
          constType: 0,
          loc: {
            start: {
              column: 138,
              line: 3,
              offset: 205,
            },
            end: {
              column: 153,
              line: 3,
              offset: 220,
            },
            source: 'changeComponent',
          },
        },
        arg: {
          type: 4,
          content: 'change-component',
          isStatic: true,
          constType: 3,
          loc: {
            start: {
              column: 120,
              line: 3,
              offset: 187,
            },
            end: {
              column: 136,
              line: 3,
              offset: 203,
            },
            source: 'change-component',
          },
        },
        modifiers: [],
        loc: {
          start: {
            column: 119,
            line: 3,
            offset: 186,
          },
          end: {
            column: 154,
            line: 3,
            offset: 221,
          },
          source: '@change-component="changeComponent"',
        },
      },
    ],
    isSelfClosing: false,
    children: [],
    loc: {
      start: {
        column: 5,
        line: 3,
        offset: 72,
      },
      end: {
        column: 22,
        line: 4,
        offset: 244,
      },
      source:
        '<button-counter class="fade-enter-activ" :style="{border:\'1px solid yellow\',color:textColor}" :title="components" @change-component="changeComponent">\n    </button-counter>',
    },
  },
  {
    type: 1,
    ns: 0,
    tag: 'div',
    tagType: 0,
    props: [
      {
        type: 6,
        name: 'style',
        value: {
          type: 2,
          content: 'border: 1px solid red',
          loc: {
            start: {
              column: 16,
              line: 5,
              offset: 260,
            },
            end: {
              column: 39,
              line: 5,
              offset: 283,
            },
            source: '"border: 1px solid red"',
          },
        },
        loc: {
          start: {
            column: 10,
            line: 5,
            offset: 254,
          },
          end: {
            column: 39,
            line: 5,
            offset: 283,
          },
          source: 'style="border: 1px solid red"',
        },
      },
    ],
    isSelfClosing: false,
    children: [
      {
        type: 1,
        ns: 0,
        tag: 'h1',
        tagType: 0,
        props: [],
        isSelfClosing: false,
        children: [
          {
            type: 2,
            content: '动态组件 component',
            loc: {
              start: {
                column: 11,
                line: 6,
                offset: 295,
              },
              end: {
                column: 25,
                line: 6,
                offset: 309,
              },
              source: '动态组件 component',
            },
          },
        ],
        loc: {
          start: {
            column: 7,
            line: 6,
            offset: 291,
          },
          end: {
            column: 30,
            line: 6,
            offset: 314,
          },
          source: '<h1>动态组件 component</h1>',
        },
      },
      {
        type: 1,
        ns: 0,
        tag: 'component',
        tagType: 1,
        props: [
          {
            type: 7,
            name: 'bind',
            exp: {
              type: 4,
              content: ' components',
              isStatic: false,
              constType: 0,
              loc: {
                start: {
                  column: 23,
                  line: 7,
                  offset: 337,
                },
                end: {
                  column: 34,
                  line: 7,
                  offset: 348,
                },
                source: ' components',
              },
            },
            arg: {
              type: 4,
              content: 'is',
              isStatic: true,
              constType: 3,
              loc: {
                start: {
                  column: 19,
                  line: 7,
                  offset: 333,
                },
                end: {
                  column: 21,
                  line: 7,
                  offset: 335,
                },
                source: 'is',
              },
            },
            modifiers: [],
            loc: {
              start: {
                column: 18,
                line: 7,
                offset: 332,
              },
              end: {
                column: 35,
                line: 7,
                offset: 349,
              },
              source: ':is=" components"',
            },
          },
        ],
        isSelfClosing: false,
        children: [],
        loc: {
          start: {
            column: 7,
            line: 7,
            offset: 321,
          },
          end: {
            column: 19,
            line: 8,
            offset: 369,
          },
          source: '<component :is=" components">\n      </component>',
        },
      },
    ],
    loc: {
      start: {
        column: 5,
        line: 5,
        offset: 249,
      },
      end: {
        column: 11,
        line: 9,
        offset: 380,
      },
      source:
        '<div style="border: 1px solid red">\n      <h1>动态组件 component</h1>\n      <component :is=" components">\n      </component>\n    </div>',
    },
  },
];
