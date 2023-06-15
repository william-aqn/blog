<main>
    <section id="about" class="bg-image">
        <section class="well-1">
            <div class="container relative">
                <h2 class="border-left">Информация <br> о работе</h2>
                <div class="row offset-1">
                    <div class="col-md-6">
                        <p>Задание только в чёткой формулировке, сложность не имеет значение.<br>Работа только за
                            деньги, можно за криптовалюту.<br>Стоимость часа - 50$.</p>
                        <ul class="inline-list links center md-left">
                            <li><a>долго</a></li>
                            <li><a>дорого</a></li>
                            <li><a>афигенно</a></li>
                        </ul>
                    </div>
                </div>
                <div class="img">
                    <div id="terminal-wrapper">
                        <div class="terminal-topbar">
                            <!--span class="button red"></span>
                                      <span class="button yellow"></span>
                                      <span class="button green"></span-->
                        </div>
                        <div id="terminal-container">
                            <div class="session">
                                <h3>Консоль управления лабораторей</h3>
                                \* Все дополнительные функции сайта доступны через эту консоль<br>
                                \*<br>
                                \* Введите help что бы узнать список команд<br>
                                \* Введите man &lt;command&gt; для детального описания команды<br>
                                \*
                            </div>
                        </div>
                    </div>
                    <!--img src="/assets/images/page-1_img01.png1" alt=""-->
                </div>
            </div>
        </section>
        <section class="well-2 bg-color">
            <div class="container">
                <div class="row">
                    <div style="clear: left" class="col-md-6">
                        <h5 class="primary-clr">Консультирую по интеграции 1С и Битрикс, подберу лицензию Битрикс.
                            Настрою сервер или хостинг для сайта.</h5>
                    </div>
                </div>
            </div>
        </section>
    </section>


    <section id="blog" class="well-5 bg-primary border-top parallax" data-url="/assets/images/header-bg-v1.jpg">
        <div class="container">
            <h2 class="border-left border-left-inv">Блог <br>Кримсона</h2>
            <div class="row">
                {% for post in site.posts %}
                <div class="col-md-12">
                    <a href="{{ post.url }}"><h3>{{ post.title }}</h3></a>
                    <noindex>{{ post.excerpt }}</noindex>
                </div>
                {% endfor %}
            </div>
        </div>
    </section>

</main>