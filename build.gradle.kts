plugins {
    id("java")
    id("application")
}

group = "org.magyarkozlony"
version = "1.0-SNAPSHOT"

java {
    toolchain {
        languageVersion = JavaLanguageVersion.of(25)
    }
}

application {
    mainClass = "org.magyarkozlony.Main"
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
