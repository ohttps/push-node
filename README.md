# OHTTPS

OHTTPS 致力于帮助用户申请免费 HTTPS/SSL 证书，提供证书**自动化更新、自动化部署、自动化监控**服务

目前已支持自动化部署证书至：[阿里云](https://ohttps.com/docs/cloud/aliyun/)、[腾讯云](https://ohttps.com/docs/cloud/tcloud/)、[Docker容器](https://ohttps.com/docs/cloud/docker/)、[七牛云](https://ohttps.com/docs/cloud/qiniu/)、[宝塔面板](https://ohttps.com/docs/cloud/btcn/)、[百度云加速](https://ohttps.com/docs/cloud/bdyjs/)、[Webhook](https://ohttps.com/docs/cloud/webhook/)、[SSH](https://ohttps.com/docs/cloud/ssh/)、[API接口](https://ohttps.com/docs/cloud/api/) 等

官网：[https://ohttps.com](https://ohttps.com)

文档：[https://ohttps.com/docs/start](https://ohttps.com/docs/start)


# push-node

push-node 是 OHTTPS 中为实现证书实时自动化部署至 **自定义容器** 而开发的证书更新服务

其原理是内部通过 socket.io 订阅 OHTTPS 服务器端证书更新事件，实现自定义容器内证书的实时自动更新

nginx、httpd、openresty 等服务的 docker 容器可结合 push-node，实现相应服务的证书自动化更新

除了与容器结合使用外，亦可独立使用，用户可根据自身的需求自行判断如何使用更为便捷


#### 如何使用
1. 在 OHTTPS 中创建 **[容器 - 自定义]** 类型的部署节点
2. 在 OHTTPS 中将需要部署至该节点的证书与该节点进行绑定
3. 编写容器 Dockerfile 文件，可参考下方[使用示例01](#使用示例01)
4. 通过 Dockerfile 文件构建容器镜像，并创建容器实例
5. 容器实例启动后 push-node 便会自动将已绑定的证书文件从服务器端拉取到本地
6. push-node 在证书首次拉取成功后，会执行 service-start-cmd，用以启动使用证书的相关服务，例如 nginx 等
7. push-node 在证书每次更新成功后，会执行 service-reload-cmd，用以重启使用证书的相关服务，例如 nginx 等

#### 参数说明
* node-id：
    * 必填，在 OHTTPS 中申请的 **[容器 - 自定义]** 类型部署节点 ID
* node-token：
    * 必填，在 OHTTPS 中申请的 **[容器 - 自定义]** 类型部署节点 TOKEN
* cert-folder：
    * 非必填，证书所在文件夹，默认为 “/etc/ohttps/certificates/”
    * 例如部署节点已绑定证书“cert-2enm4pr1q09g3x5z”，那么该证书相应证书文件的路径为：
        * 私钥文件cert.key（PEM格式）：/etc/ohttps/certificates/cert-2enm4pr1q09g3x5z/cert.key
        * 证书文件fullchain.cer（PEM格式）：/etc/ohttps/certificates/cert-2enm4pr1q09g3x5z/fullchain.cer
* service-start-cmd：
    * 非必填，证书文件首次下载后执行的启动命令，例如“nginx -c /etc/nginx/nginx.conf”，可实现在证书首次下载完成后启动nginx
* service-reload-cmd：
    * 非必填，证书文件每次更新后执行的重载命令，例如“nginx -c /etc/nginx/nginx.conf -s reload”，实现在证书每次更新后重启nginx


#### 二进制包
* push-node-alpine-arm64：
    * https://github.com/ohttps/push-node/releases/download/1.0.0/push-node-alpine-arm64
* push-node-alpine-x64：
    * https://github.com/ohttps/push-node/releases/download/1.0.0/push-node-alpine-x64
* push-node-linux-arm64：
    * https://github.com/ohttps/push-node/releases/download/1.0.0/push-node-linux-arm64
* push-node-linux-x64：
    * https://github.com/ohttps/push-node/releases/download/1.0.0/push-node-linux-x64
* push-node-macos-arm64：
    * https://github.com/ohttps/push-node/releases/download/1.0.0/push-node-macos-arm64
* push-node-macos-x64：
    * https://github.com/ohttps/push-node/releases/download/1.0.0/push-node-macos-x64
* 注意：**使用时请根据系统架构自行选择合适的二进制包**
* 注意：**最新版本请查看[release](https://github.com/ohttps/push-node/releases)列表**


#### 使用示例01
**配合容器使用，系统为 alpine-x64，服务为 nginx**

nginx 容器结合 push-node，实现 nginx 容器内的证书自动化更新

可查看本仓库中的完整示例代码：https://github.com/ohttps/push-node/tree/main/examples/nginx

注意：**需提前下载push-node-alpine-x64二进制文件到本地，通过COPY命令复制进容器镜像中**

```Dockerfile
FROM nginx:stable-alpine
# 删除官方容器镜像中的默认日志
# 否则启动nginx命令会报日志权限异常
RUN unlink /var/log/nginx/access.log
RUN unlink /var/log/nginx/error.log
# 设置当前工作文件夹
WORKDIR /etc/nginx
# 复制nginx配置文件
COPY ./nginx.conf .
# 复制push-node二进制包
COPY ./push-node-alpine-x64 .
# 为push-node添加可执行权限
RUN chmod a+x ./push-node-alpine-x64
# 设置容器启动命令
ENTRYPOINT ["./push-node-alpine-x64", "--node-id=push-mlyxpro7vo0ez6jw", "--node-token=b4f2f70c85466671bc06d7f1f469395d", "--cert-folder=/etc/nginx/certificates/", "--service-start-cmd='nginx'", "--service-reload-cmd='nginx -s reload'"]
```


#### 使用示例02
**独立使用，系统为 macos-x64，服务为 nginx**

nginx 结合 push-node，实现 nginx 内证书自动化更新

```shell
// 下载macos-x64系统对应的push-node二进制文件
wget https://github.com/ohttps/push-node/releases/download/1.0.0/push-node-macos-x64

// 为push-node添加执行权限
chmod a+x ./push-node-macos-x64

// 启动push-node
./push-node-macos-x64 --node-id=push-mlyxpro7vo0ez6jw \
    --node-token=b4f2f70c85466671bc06d7f1f469395d \
    --cert-folder=./certificates/ \
    --service-start-cmd="nginx" \
    --service-reload-cmd="nginx -s reload"
```
