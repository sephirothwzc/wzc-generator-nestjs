# Git global setup

```s
# 设置
$ git config --global user.name "zhanchao.wu"
$ git config --global user.email "zhanchao.wu@icloud.com"
```

- Create a new repository

```s
# 新项目
$ git clone git@gitlab.cyberstone.com.cn:midway-base/yongding-river.git
$ cd yongding-river
$ touch README.md
$ git add README.md
$ git commit -m "add README"
$ git push -u origin master
```

- Push an existing folder

```s
# 存在项目
$ cd existing_folder
$ git init
$ git remote add origin git@gitlab.cyberstone.com.cn:midway-base/yongding-river.git
$ git add .
$ git commit -m "Initial commit"
$ git push -u origin master
```

Push an existing Git repository

```s
# 替换git
$ cd existing_repo
$ git remote rename origin old-origin
$ git remote add origin git@gitlab.cyberstone.com.cn:midway-base/yongding-river.git
$ git push -u origin --all
$ git push -u origin --tags
```
