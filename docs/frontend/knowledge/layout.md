#### 盒子宽度计算

offsetwidth: padding + border + width

#### margin 纵向重叠问题

同级元素纵向重叠及父子级元素重叠

父子级则最好只在父级设置margin，父子的间距使用padding或者border挤开(不推荐)
使用BFC效果最好

```css
<style>
p{
    font-size :16px;
    line-height: 1;
    margin-top: 10px;
    margin-bottom: 15px;
}
</style>

<p>AAA</p>
<p></p>
<p></p>
<p></p>
<p>BBB</p>
```
对于盒模型，没有加定位时纵向的margin会重叠，只保留最大的margin

A B之间的纵向距离： 15px 一般空标签未指明height时不占用空间

#### margin 负值问题

- `margin-top`、`margin-left`为负值时本身元素移动（对于其左方、上方元素来说占据空间变小），与`margin-right`、`margin-bottom`原理相同

- `margin-right`、`margin-bottom`为负值则右边或者下边的元素移动
  相当于是在其他元素（右方、下方的元素）看来此元素减小了，占据的空间变小 如`margin-right: -100px`相当于元素不占空间

#### 盒子塌陷

当父元素没设置足够大小的时候，而子元素设置了浮动的属性，子元素就会跳出父元素的边界（脱离文档流），尤其是当父元素的高度为auto时，而父元素中又没有其它非浮动的可见元素时，父盒子的高度就会直接塌陷为零

处理方法：
- BFC
- 清除浮动
- 加border
- padding-top

#### BFC

BFC: Block format context
一块独立的渲染区域，内部元素的渲染不会影响边界以外的元素

形成条件：
- float不是none
- position为 absolute和fixed
- overflow不是visible
- display是flex 或 inline-block等

常用来清除浮动

#### float 及clearfix

```html
    <style type="text/css">
        .container {
            background-color: #f1f1f1;
        }
        .left {
            float: left;
        }
        .bfc {
            overflow: hidden; /* 触发元素 BFC */
        }
    </style>

<body>
    <div class="container bfc">
    <!-- 图片的src需要进行修改才可使用 -->
        <img src="xxx.png" class="left" style="magin-right: 10px;"/>
        <p class="bfc">某一段文字……</p>
    </div>
</body>
```

#### 圣杯布局

```html
        body {
            min-width: 550px;
        }

        #header {
            text-align: center;
            background-color: #f1f1f1;
        }

        #container {
            padding-left: 200px;
            padding-right: 150px;
        }

        #center {
            background-color: #ccc;
            width: 100%;
            float: left;
        }

        #left {
            position: relative;
            background-color: yellow;
            width: 200px;
            margin-left: -100%;
            right: 200px;
            float: left;
        }

        #right {
            background-color: red;
            width: 150px;
            margin-right: -150px;
            float: left;
        }

        #footer {
            text-align: center;
            background-color: #f1f1f1;
        }

        /* 手写 clearfix */
        .clearfix:after {
            content: '';
            display: table;
            clear: both;
        }
    </style>
<body>
    <div id="header">this is header</div>
    <div id="container" class="clearfix">
        <div id="center" class="column">this is center</div>
        <div id="left" class="column">this is left</div>
        <div id="right" class="column">this is right</div>
    </div>
    <div id="footer">this is footer</div>
</body>

```

当margin-left取负值的时候对于对于他左边的盒子来说他所占的空间也在缩小（类似margin-right取负值）-100%是对于父元素container来说的，与父元素的间隔为-100%刚好和父元素的border对齐。同理右栏的margin-right设为-100%也是可以的
参考[圣杯布局中对left盒子设置负内边距-100%的一点解释](https://segmentfault.com/a/1190000014546205)


#### 双飞翼布局

```html
<style type="text/css">
    body {
        min-width: 550px;
    }
    
    #main {
        width: 100%;
        height: 200px;
        background-color: #ccc;
        float: left;
    }

    #main-wrap {
        margin: 0 190px 0 190px;
    }

    #left {
        width: 190px;
        height: 200px;
        background-color: #0000FF;
        margin-left: -100%;
        float: left;
    }

    #right {
        width: 190px;
        height: 200px;
        background-color: #FF0000;
        margin-left: -190px;
        float: left;
    }
</style>

<body>
    <div id="main">
        <div id="main-wrap">
            this is main
        </div>
    </div>
    <div id="left">
        this is left
    </div>
    <div id="right">
        this is right
    </div>
</body>

```


#### flex布局

```css
flex-flow: flex-direction=row flex-wrap=nowrap;
flex: flex-grow=1 flex-shrink=1 flex-basis=0;/*flex-basis为默认盒子大小，需要单位*/
align-items: stretch/flex-start/flex-end/center;/*沿交叉轴方向对齐*/
justify-content:stretch/flex-start/flex-end/center/space-around/space-between; /*沿主轴方向对齐*/
```




#### line-height继承

- 具体数值：直接继承该值
- 比例：继承比例
- 百分比：继承根据百分比计算出来的值

#### 响应式

##### rem

相对于根元素的相对单位长度

```css
html{
  font-size: 16px;
}
```

##### vh vw

vh网页视口的高度的1/10
vw网页视口的宽度的1/10