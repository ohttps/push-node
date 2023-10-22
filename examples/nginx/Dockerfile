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