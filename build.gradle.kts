plugins {
    id("java")
    id("application")
}

group = "org.torvenygyar"
version = "1.0-SNAPSHOT"

java {
    toolchain {
        languageVersion = JavaLanguageVersion.of(25)
    }
}

application {
    mainClass = "org.torvenygyar.Main"
}

repositories {
    mavenCentral()
}

dependencies {
    implementation("org.jsoup:jsoup:1.18.3")
    implementation("org.apache.pdfbox:pdfbox:3.0.3")

    testImplementation(platform("org.junit:junit-bom:5.10.0"))
    testImplementation("org.junit.jupiter:junit-jupiter")
    testRuntimeOnly("org.junit.platform:junit-platform-launcher")
}

tasks.test {
    useJUnitPlatform()
}

tasks.named<JavaExec>("run") {
    // Allow passing e.g. --args="--from=1 --to=1"
    standardInput = System.`in`
}

tasks.register<JavaExec>("viz") {
    group = "application"
    description = "Serves the results.csv visualization on http://localhost:8080"
    classpath = sourceSets.main.get().runtimeClasspath
    mainClass = "org.torvenygyar.VizServer"
}
