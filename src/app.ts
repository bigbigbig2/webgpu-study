export class App {
  public canvas: HTMLCanvasElement;
  public context: GPUCanvasContext;
  public adapter: GPUAdapter; //显示适配器，也就是显卡
  public device: GPUDevice;
  public format: GPUTextureFormat = "bgra8unorm";
  public commandEncoder: GPUCommandEncoder; //指令编码器
  public renderPassEncoder: GPURenderPassEncoder;
  public uniformGroupLayout: GPUBindGroupLayout;
  public renderPipeline: GPURenderPipeline; //渲染管线

  public CreateCanvas(rootElement: HTMLElement) {
    //获取颜色缓冲区的颜色尺寸
    let width = rootElement.clientWidth;
    let height = rootElement.clientHeight;

    this.canvas = document.createElement("canvas");

    //canvas颜色缓冲区尺寸
    this.canvas.width = width;
    this.canvas.height = height;

    //设置显示尺寸为父元素的高宽，等同于直接将颜色缓冲区高宽赋值给样式高宽
    this.canvas.style.width = "100%";
    this.canvas.style.height = "100%";

    rootElement.appendChild(this.canvas);
  }

  public async InitWebGPU() {
    const entry: GPU = navigator.gpu;
    if (!entry) {
      throw new Error("WebGPU is not supported on this browser.");
    }
    this.adapter = await navigator.gpu.requestAdapter();
    // this.adapter = await navigator.gpu.requestAdapter({
    //   powerPreference: "high-performance",
    // });
    this.device = await this.adapter.requestDevice();
    this.context = (<unknown>(
      this.canvas.getContext("webgpu")
    )) as GPUCanvasContext;

    this.context.configure({
      device: this.device,
      format: this.format,
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });

    if (this.context) {
      console.info(`Congratulations! You've got a WebGPU context!`);
    } else {
      throw new Error("Your browser seems not support WebGPU!");
    }
  }

  //渲染通道：RenderPass
  public InitRenderPass(clearColor: GPUColorDict) {
    //创建指令编码器
    this.commandEncoder = this.device.createCommandEncoder();
    //渲染通道编码器
    let renderPassDescriptor: GPURenderPassDescriptor = {
      //颜色附件
      colorAttachments: [
        {
          view: this.context.getCurrentTexture().createView(),
          loadOp: "clear",
          storeOp: "store",
          clearValue: clearColor,
        },
      ],
    };
    //开启一个渲染通道
    this.renderPassEncoder =
      this.commandEncoder.beginRenderPass(renderPassDescriptor);
    //设置这个渲染通道的视口大小,同webGL中的gl.viewport()
    this.renderPassEncoder.setViewport(
      0,
      0,
      this.canvas.clientWidth,
      this.canvas.clientHeight,
      0,
      1
    );
  }

  public InitPipeline(vxCode: string, fxCode: string) {
    //创建一个绑定资源组布局
    this.uniformGroupLayout = this.device.createBindGroupLayout({
      entries: [
        {
          binding: 0, //binding 索引值是 0
          visibility: GPUShaderStage.VERTEX, //可见性，也就是说它位于顶点着色器
          buffer: {
            type: "uniform",
          },
        },
      ],
    });
    //创建一个管线布局
    let layout: GPUPipelineLayout = this.device.createPipelineLayout({
      bindGroupLayouts: [this.uniformGroupLayout], //绑定到渲染管线
    });

    //引入的字符串形式的着色器代码进行编译。
    let vxModule: GPUShaderModule = this.device.createShaderModule({
      code: vxCode,
    });
    let fxModule: GPUShaderModule = this.device.createShaderModule({
      code: fxCode,
    });

    //创建渲染管线
    this.renderPipeline = this.device.createRenderPipeline({
      layout: layout,
      //顶点着色器阶段,使用我们刚刚编译好的vxModule，并且指出入口函数的名字叫做main
      vertex: {
        buffers: [
          {
            arrayStride: 4 * 3,
            attributes: [
              {
                shaderLocation: 0,
                offset: 0,
                format: "float32x3",
              },
            ],
          },
        ],
        module: vxModule, //使用刚刚上面编译好的顶点着色器
        entryPoint: "main", //着色器入口函数
      },

      fragment: {
        module: fxModule, //编译好的着色器
        entryPoint: "main",
        targets: [
          {
            format: this.format,
          },
        ],
      },
      //绘图模式
      primitive: {
        topology: "triangle-list",
      },
    });
    //把渲染管线设置到渲染通道上
    this.renderPassEncoder.setPipeline(this.renderPipeline);
  }

  private _CreateGPUBuffer(typedArray: TypedArray, usage: GPUBufferUsageFlags) {
    //创建GPU缓存
    let gpuBuffer = this.device.createBuffer({
      size: typedArray.byteLength, //GPU 缓存的长度
      usage: usage | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true,
    });

    let constructor = typedArray.constructor as new (
      buffer: ArrayBuffer
    ) => TypedArray;
    let view = new constructor(gpuBuffer.getMappedRange());
    view.set(typedArray, 0);
    gpuBuffer.unmap();
    return gpuBuffer;
  }
}
