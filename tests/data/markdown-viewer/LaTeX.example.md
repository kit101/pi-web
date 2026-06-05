# LaTeX 公式示例

## 1. 多行方程组

$$
\begin{cases}
a_1 x + b_1 y + c_1 z = d_1 \\[2ex]
a_2 x + b_2 y + c_2 z = d_2 \\[2ex]
a_3 x + b_3 y + c_3 z = d_3
\end{cases}
$$

## 2. 矩阵乘法

$$
\begin{bmatrix}
a_{11} & a_{12} & \cdots & a_{1n} \\
a_{21} & a_{22} & \cdots & a_{2n} \\
\vdots & \vdots & \ddots & \vdots \\
a_{m1} & a_{m2} & \cdots & a_{mn}
\end{bmatrix}
\times
\begin{bmatrix}
x_{1} \\
x_{2} \\
\vdots \\
x_{n}
\end{bmatrix}
=
\begin{bmatrix}
b_{1} \\
b_{2} \\
\vdots \\
b_{m}
\end{bmatrix}
$$

## 3. 泰勒级数展开

$$
f(x) = \sum_{n=0}^{\infty} \frac{f^{(n)}(a)}{n!} (x - a)^n
$$

## 4. 高斯积分

$$
\int_{-\infty}^{\infty} e^{-x^2} \, dx = \sqrt{\pi}
$$

## 5. 麦克斯韦方程组（积分形式）

$$
\left\{
\begin{aligned}
\oint_{\partial \Omega} \mathbf{E} \cdot d\mathbf{l} &= -\frac{d}{dt} \iint_{\Omega} \mathbf{B} \cdot d\mathbf{S} \\[2ex]
\oint_{\partial \Omega} \mathbf{B} \cdot d\mathbf{l} &= \mu_0 I + \mu_0 \varepsilon_0 \frac{d}{dt} \iint_{\Omega} \mathbf{E} \cdot d\mathbf{S} \\[2ex]
\iint_{\partial \Omega} \mathbf{E} \cdot d\mathbf{S} &= \frac{Q}{\varepsilon_0} \\[2ex]
\iint_{\partial \Omega} \mathbf{B} \cdot d\mathbf{S} &= 0
\end{aligned}
\right.
$$

## 6. 薛定谔方程（含拉普拉斯算符）

$$
i\hbar\frac{\partial}{\partial t} \Psi(\mathbf{r}, t) = \left[ -\frac{\hbar^2}{2m} \nabla^2 + V(\mathbf{r}, t) \right] \Psi(\mathbf{r}, t)
$$

## 7. 斐波那契数列封闭形式（比奈公式）

$$
F_n = \frac{\varphi^n - \psi^n}{\sqrt{5}},\quad \varphi = \frac{1+\sqrt{5}}{2},\quad \psi = \frac{1-\sqrt{5}}{2}
$$

## 8. 黎曼 zeta 函数

$$
\zeta(s) = \sum_{n=1}^{\infty} \frac{1}{n^s} = \prod_{p \in \mathbb{P}} \frac{1}{1 - p^{-s}},\quad \Re(s) > 1
$$

## 9. 复杂分式（连分数）

$$
\pi = 3 + \cfrac{1}{7 + \cfrac{1}{15 + \cfrac{1}{1 + \cfrac{1}{292 + \cfrac{1}{1 + \cfrac{1}{1 + \ddots}}}}}}
$$

## 10. 大括号多行对齐（综合公式）

$$
\begin{aligned}
\mathbb{E}[X] &= \int_{-\infty}^{\infty} x f(x) \, dx \\[2ex]
\operatorname{Var}(X) &= \mathbb{E}[X^2] - \bigl(\mathbb{E}[X]\bigr)^2 \\[2ex]
&= \int_{-\infty}^{\infty} \bigl( x - \mu \bigr)^2 f(x) \, dx \\[2ex]
\sigma &= \sqrt{\operatorname{Var}(X)}
\end{aligned}
$$

## 11. 集合定义与元素

集合定义：$X = \{x_1, x_2, \dots, x_n\}$

元素属于：$x \in \mathbb{R}$，$\mathbf{x} \in \mathbb{R}^n$

空集：$\varnothing$

## 12. 集合运算

交集：$A \cap B$

并集：$A \cup B$

子集：$A \subseteq B$，真子集 $A \subsetneq B$

补集：$\complement A$ 或 $A^c$

差集：$A \setminus B$

## 13. 映射与函数

映射定义：$f: \mathcal{D} \to \mathbb{R}$

复合映射：$g \circ f$

函数值：$f(x) = y$

## 14. 求和与求积

求和：$\displaystyle\sum_{i=1}^{n} w_i x_i$

求积：$\displaystyle\prod_{i=1}^{k} p_i$

双重求和：$\displaystyle\sum_{i=1}^{m}\sum_{j=1}^{n} a_{ij}$

## 15. 加权组合

加权指数：$I = \displaystyle\sum_{i=1}^{n} \omega_i \cdot s_i$

权重约束：$\displaystyle\sum_{i=1}^{n} \omega_i = 1,\quad \omega_i \ge 0$

归一化：$\hat{x}_i = \dfrac{x_i - x_{\min}}{x_{\max} - x_{\min}}$

## 16. 向量与转置

行向量：$\vec{w} = (w_1, w_2, \dots, w_m)^\mathsf{T}$

内积：$\langle \mathbf{a}, \mathbf{b} \rangle = \mathbf{a}^\mathsf{T}\mathbf{b}$

外积：$\mathbf{a} \otimes \mathbf{b}$

## 17. 范数

欧几里得范数：$\|\mathbf{x}\|_2 = \sqrt{\sum_{i=1}^{n} x_i^2}$

L1 范数：$\|\mathbf{x}\|_1 = \sum_{i=1}^{n} |x_i|$

无穷范数：$\|\mathbf{x}\|_\infty = \max_{1 \le i \le n} |x_i|$

## 18. 条件概率

条件概率：$P(A \mid B) = \dfrac{P(A \cap B)}{P(B)}$

贝叶斯公式：$P(H \mid D) = \dfrac{P(D \mid H)\,P(H)}{P(D)}$

全概率公式：$P(A) = \sum_{i=1}^{n} P(A \mid B_i)\,P(B_i)$

## 19. 偏导数与梯度

偏导数：$\dfrac{\partial f}{\partial x_i}$

梯度：$\nabla f(\mathbf{x}) = \left( \dfrac{\partial f}{\partial x_1}, \dfrac{\partial f}{\partial x_2}, \dots, \dfrac{\partial f}{\partial x_n} \right)^\mathsf{T}$

Hessian 矩阵：$\nabla^2 f(\mathbf{x})_{ij} = \dfrac{\partial^2 f}{\partial x_i \partial x_j}$

## 20. 极限与收敛

极限：$\displaystyle\lim_{n \to \infty} a_n = L$

趋于无穷大：$x \to +\infty$

收敛：$a_n \to 0 \quad (n \to \infty)$

## 21. 分段函数

$$f(x) = \begin{cases}
x^2, & x \ge 0 \\[1ex]
0,  & x < 0
\end{cases}$$

## 22. 花体与黑板体

花体字母：$\mathcal{A}, \mathcal{B}, \mathcal{C}, \mathcal{D}, \mathcal{F}$

黑板体（数集）：$\mathbb{N}, \mathbb{Z}, \mathbb{Q}, \mathbb{R}, \mathbb{C}$

## 23. 上下标

多重下标：$x_{ij}$，$a_{i_1 i_2 \dots i_k}$

上标与下标组合：$x_{ij}^{(k)}$，$a^{2}_{i,j}$

双下标：$\omega_{ij}^{(t)}$

## 24. 指标函数（示性函数）

$$\mathbb{I}_{\{x > 0\}} = \begin{cases}
1, & x > 0 \\[1ex]
0, & x \le 0
\end{cases}$$

## 25. 大括号多分支（Kronecker delta）

$$\delta_{ij} = \begin{cases}
1, & i = j \\[1ex]
0, & i \neq j
\end{cases}$$
